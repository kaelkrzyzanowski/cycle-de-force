package fr.cycledeforce.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Points GPS de l'enregistrement en cours, en mémoire et recopiés dans un fichier
 * (une ligne « lat,lon,t,seg,précision » par point) pour survivre à l'arrêt de l'app.
 */
final class TrackStore {

    private static final String FILE = "track-en-cours.csv";
    private static final String PREFS = "cdf_track";

    private static List<double[]> points;

    private TrackStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static File file(Context context) {
        return new File(context.getApplicationContext().getFilesDir(), FILE);
    }

    private static List<double[]> load(Context context) {
        if (points != null) return points;
        points = new ArrayList<>();
        File f = file(context);
        if (!f.exists()) return points;
        try (BufferedReader reader = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split(",");
                if (parts.length != 5) continue;
                double[] p = new double[5];
                for (int i = 0; i < 5; i++) p[i] = Double.parseDouble(parts[i]);
                points.add(p);
            }
        } catch (IOException | NumberFormatException ignored) {
            // ligne tronquée par un arrêt brutal : les points lus jusque-là sont gardés
        }
        return points;
    }

    static synchronized void add(Context context, double lat, double lon, long t, int seg, float accuracy) {
        double[] p = { lat, lon, t, seg, accuracy };
        load(context).add(p);
        String line = String.format(Locale.US, "%.7f,%.7f,%d,%d,%.1f%n", lat, lon, t, seg, accuracy);
        try (FileOutputStream out = new FileOutputStream(file(context), true)) {
            out.write(line.getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
            // le point reste en mémoire
        }
    }

    /** Points à partir de l'indice `from`. */
    static synchronized List<double[]> since(Context context, int from) {
        List<double[]> all = load(context);
        return new ArrayList<>(all.subList(Math.min(Math.max(0, from), all.size()), all.size()));
    }

    static synchronized void clear(Context context) {
        points = new ArrayList<>();
        //noinspection ResultOfMethodCallIgnored
        file(context).delete();
        prefs(context).edit().clear().apply();
    }
}
