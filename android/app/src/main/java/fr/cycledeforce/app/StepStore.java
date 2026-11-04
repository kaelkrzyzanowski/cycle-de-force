package fr.cycledeforce.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pas par jour, calculés à partir du compteur matériel du téléphone (cumul depuis le démarrage).
 * Chaque relevé ajoute l'écart avec le précédent au jour en cours ; un redémarrage remet le compteur à zéro.
 */
final class StepStore {

    private static final String PREFS = "cdf_steps";
    private static final String KEY_DAYS = "days";
    private static final String KEY_LAST = "last";
    private static final String KEY_BOOT = "boot";
    private static final String KEY_ENABLED = "enabled";
    /** Au-delà, l'écart est jugé aberrant (compteur réinitialisé par le système) : on repart de ce relevé. */
    private static final long MAX_DELTA = 100_000;
    private static final int KEEP_DAYS = 800;

    private StepStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    /** Enregistre un relevé du compteur et renvoie le total du jour. */
    static synchronized int record(Context context, long counter) {
        SharedPreferences p = prefs(context);
        long boot = System.currentTimeMillis() - SystemClock.elapsedRealtime();
        long last = p.getLong(KEY_LAST, -1);
        boolean rebooted = Math.abs(boot - p.getLong(KEY_BOOT, boot)) > 60_000;

        long delta;
        if (last < 0) delta = 0; // premier relevé : simple point de départ
        else if (rebooted || counter < last) delta = counter; // compteur reparti de zéro
        else delta = counter - last;
        if (delta < 0 || delta > MAX_DELTA) delta = 0;

        JSONObject days = readDays(p);
        String day = today();
        int total = days.optInt(day, 0) + (int) delta;
        try {
            days.put(day, total);
        } catch (JSONException ignored) {
            // clé et valeur toujours valides
        }
        prune(days);
        p.edit().putLong(KEY_LAST, counter).putLong(KEY_BOOT, boot).putString(KEY_DAYS, days.toString()).apply();
        return total;
    }

    static synchronized JSONObject days(Context context) {
        return readDays(prefs(context));
    }

    static synchronized int todaySteps(Context context) {
        return readDays(prefs(context)).optInt(today(), 0);
    }

    private static JSONObject readDays(SharedPreferences p) {
        try {
            return new JSONObject(p.getString(KEY_DAYS, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void prune(JSONObject days) {
        if (days.length() <= KEEP_DAYS) return;
        List<String> keys = new ArrayList<>();
        for (Iterator<String> it = days.keys(); it.hasNext(); ) keys.add(it.next());
        Collections.sort(keys);
        for (int i = 0; i < keys.size() - KEEP_DAYS; i++) days.remove(keys.get(i));
    }
}
