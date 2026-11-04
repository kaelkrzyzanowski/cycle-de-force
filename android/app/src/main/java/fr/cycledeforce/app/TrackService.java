package fr.cycledeforce.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Enregistrement GPS d'une activité, écran éteint compris : service au premier plan de type « location »,
 * démarré depuis l'app ouverte. Les points bruts vont dans TrackStore ; le tri (précision, sauts) se fait côté app.
 */
public class TrackService extends Service implements LocationListener {

    static final String ACTION_START = "start";
    static final String ACTION_PAUSE = "pause";
    static final String ACTION_RESUME = "resume";

    private static final String KEY_RECORDING = "recording";
    private static final String KEY_PAUSED = "paused";
    private static final String KEY_SEG = "seg";
    private static final String KEY_TITLE = "title";
    private static final String KEY_BASE = "chronoBase";
    private static final long MIN_INTERVAL_MS = 1_000;

    private LocationManager locations;
    private boolean listening;

    static void send(Context context, String action, String title, long elapsedMs) {
        Intent intent = new Intent(context, TrackService.class).setAction(action);
        intent.putExtra("title", title);
        intent.putExtra("elapsedMs", elapsedMs);
        ContextCompat.startForegroundService(context, intent);
    }

    static void stop(Context context) {
        TrackStore.prefs(context).edit().putBoolean(KEY_RECORDING, false).apply();
        context.stopService(new Intent(context, TrackService.class));
    }

    static boolean isRecording(Context context) {
        return TrackStore.prefs(context).getBoolean(KEY_RECORDING, false);
    }

    static boolean isPaused(Context context) {
        return TrackStore.prefs(context).getBoolean(KEY_PAUSED, false);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Notifications.ensureChannels(this);
        locations = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences p = TrackStore.prefs(this);
        String action = intent == null ? null : intent.getAction();
        long now = System.currentTimeMillis();
        SharedPreferences.Editor edit = p.edit();
        if (ACTION_START.equals(action)) {
            edit.putBoolean(KEY_RECORDING, true).putBoolean(KEY_PAUSED, false).putInt(KEY_SEG, 0)
                .putString(KEY_TITLE, intent.getStringExtra("title")).putLong(KEY_BASE, now);
        } else if (ACTION_PAUSE.equals(action)) {
            edit.putBoolean(KEY_PAUSED, true);
        } else if (ACTION_RESUME.equals(action) && p.getBoolean(KEY_PAUSED, false)) {
            edit.putBoolean(KEY_PAUSED, false).putInt(KEY_SEG, p.getInt(KEY_SEG, 0) + 1)
                .putLong(KEY_BASE, now - intent.getLongExtra("elapsedMs", 0));
        }
        edit.apply();

        if (!p.getBoolean(KEY_RECORDING, false)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            ServiceCompat.startForeground(this, Notifications.ID_TRACK, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } catch (RuntimeException e) {
            // Localisation refusée ou service lancé app fermée : impossible d'enregistrer.
            stopSelf();
            return START_NOT_STICKY;
        }
        listen();
        return START_STICKY;
    }

    @SuppressLint("MissingPermission")
    private void listen() {
        if (listening || locations == null) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        if (!locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) return;
        locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, MIN_INTERVAL_MS, 0f, this, Looper.getMainLooper());
        listening = true;
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        SharedPreferences p = TrackStore.prefs(this);
        if (!p.getBoolean(KEY_RECORDING, false) || p.getBoolean(KEY_PAUSED, false)) return;
        float accuracy = location.hasAccuracy() ? location.getAccuracy() : 999f;
        TrackStore.add(this, location.getLatitude(), location.getLongitude(), location.getTime(), p.getInt(KEY_SEG, 0), accuracy);
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {}

    @Override
    public void onProviderEnabled(@NonNull String provider) {}

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    private Notification notification() {
        SharedPreferences p = TrackStore.prefs(this);
        boolean paused = p.getBoolean(KEY_PAUSED, false);
        String title = p.getString(KEY_TITLE, "Activité");
        NotificationCompat.Builder builder = Notifications.base(this, Notifications.CHANNEL_TRACK, R.drawable.ic_stat_track)
            .setContentTitle(title)
            .setContentText(paused ? "En pause" : "Enregistrement GPS en cours")
            .setContentIntent(Notifications.openApp(this, "#/activite"));
        if (paused) builder.setShowWhen(false);
        else builder.setWhen(p.getLong(KEY_BASE, System.currentTimeMillis())).setUsesChronometer(true).setShowWhen(true);
        return builder.build();
    }

    @Override
    public void onDestroy() {
        if (listening && locations != null) locations.removeUpdates(this);
        listening = false;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(Notifications.ID_TRACK);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
