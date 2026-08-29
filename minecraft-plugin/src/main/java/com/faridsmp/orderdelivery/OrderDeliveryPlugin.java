package com.faridsmp.orderdelivery;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class OrderDeliveryPlugin extends JavaPlugin {

    private HttpClient httpClient;
    private String baseUrl;
    private String pluginKey;
    private int pollIntervalSeconds;
    private final Set<String> warnedMissingItemIds = new HashSet<>();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        reloadSettings();

        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        long periodTicks = Math.max(pollIntervalSeconds, 5) * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::pollOrders, 100L, periodTicks);

        getLogger().info("FaridSmp Order Delivery aktif — polling tiap " + pollIntervalSeconds + " detik.");
    }

    private void reloadSettings() {
        reloadConfig();
        baseUrl = getConfig().getString("api.base-url", "").replaceAll("/+$", "");
        pluginKey = getConfig().getString("api.plugin-key", "");
        pollIntervalSeconds = getConfig().getInt("api.poll-interval-seconds", 15);
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            reloadSettings();
            sender.sendMessage(ChatColor.GREEN + "[FaridSmp] Config di-reload.");
            return true;
        }
        if (args.length > 0 && args[0].equalsIgnoreCase("check")) {
            sender.sendMessage(ChatColor.YELLOW + "[FaridSmp] Mengecek order sekarang...");
            Bukkit.getScheduler().runTaskAsynchronously(this, this::pollOrders);
            return true;
        }
        sender.sendMessage(ChatColor.GRAY + "Usage: /fsorders <check|reload>");
        return true;
    }

    /** Runs off the main thread — does the HTTP call, then hops back to the main thread to run commands. */
    private void pollOrders() {
        if (baseUrl.isEmpty() || pluginKey.isEmpty() || pluginKey.startsWith("CHANGE-ME")) {
            getLogger().warning("Plugin belum di-setup: isi api.base-url dan api.plugin-key di config.yml (harus sama dengan env var PLUGIN_API_KEY di Vercel).");
            return;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/pending-orders"))
                    .header("X-Plugin-Key", pluginKey)
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                getLogger().warning("Gagal ambil order (HTTP " + response.statusCode() + "): " + response.body());
                return;
            }

            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            JsonArray orders = json.has("orders") ? json.getAsJsonArray("orders") : new JsonArray();

            for (JsonElement el : orders) {
                JsonObject order = el.getAsJsonObject();
                // Hop back onto the main thread — dispatching commands must not happen off it.
                Bukkit.getScheduler().runTask(this, () -> deliverOrder(order));
            }
        } catch (Exception e) {
            getLogger().warning("Error waktu polling order: " + e.getMessage());
        }
    }

    /** Runs on the main thread. */
    private void deliverOrder(JsonObject order) {
        String id = getString(order, "id");
        String itemId = getString(order, "itemId");
        String nickname = getString(order, "nickname");
        String platform = getString(order, "platform");
        int qty = order.has("qty") && !order.get("qty").isJsonNull() ? order.get("qty").getAsInt() : 1;

        if (id == null || itemId == null || nickname == null) {
            getLogger().warning("Order tidak lengkap, dilewati: " + order);
            return;
        }

        ConfigurationSection itemSection = getConfig().getConfigurationSection("items." + itemId);
        if (itemSection == null) {
            if (warnedMissingItemIds.add(itemId)) {
                getLogger().warning("Tidak ada mapping command untuk item id '" + itemId + "' di config.yml — order " + id + " DILEWATI (tidak ditandai selesai, akan dicoba lagi tiap poll). Tambahkan mapping-nya lalu /fsorders reload.");
            }
            return;
        }

        for (String rawCmd : itemSection.getStringList("commands")) {
            String cmd = rawCmd.replace("%player%", nickname).replace("%qty%", String.valueOf(qty));
            try {
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
            } catch (Exception e) {
                getLogger().warning("Gagal jalankan command '" + cmd + "' untuk order " + id + ": " + e.getMessage());
            }
        }

        Player online = Bukkit.getPlayerExact(nickname);
        if (online != null && online.isOnline()) {
            String msg = getConfig().getString("messages.delivered", "&a[FaridSmp] Pesanan kamu sudah dikirim!");
            online.sendMessage(ChatColor.translateAlternateColorCodes('&', msg));
        }

        getLogger().info("Order " + id + " delivered -> item=" + itemId + " qty=" + qty + " nick=" + nickname + " platform=" + platform);

        Bukkit.getScheduler().runTaskAsynchronously(this, () -> markFulfilled(id));
    }

    /** Runs off the main thread. */
    private void markFulfilled(String orderId) {
        try {
            String body = "{\"id\":\"" + orderId.replace("\"", "\\\"") + "\"}";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/mark-fulfilled"))
                    .header("X-Plugin-Key", pluginKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                getLogger().warning("Gagal tandai order " + orderId + " selesai (HTTP " + response.statusCode() + "): " + response.body());
            }
        } catch (Exception e) {
            getLogger().warning("Error waktu tandai order " + orderId + " selesai: " + e.getMessage());
        }
    }

    private static String getString(JsonObject obj, String key) {
        if (!obj.has(key) || obj.get(key).isJsonNull()) return null;
        return obj.get(key).getAsString();
    }
}
