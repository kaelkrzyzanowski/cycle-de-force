package fr.cycledeforce.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/** Canaux et notifications permanentes des services (podomètre, enregistrement GPS). */
final class Notifications {

    static final String CHANNEL_STEPS = "podometre";
    static final String CHANNEL_TRACK = "enregistrement";
    static final int ID_STEPS = 7101;
    static final int ID_TRACK = 7102;

    private Notifications() {}

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel steps = new NotificationChannel(CHANNEL_STEPS, "Podomètre", NotificationManager.IMPORTANCE_MIN);
        steps.setDescription("Pas du jour, compteur actif en arrière-plan");
        steps.setShowBadge(false);
        NotificationChannel track = new NotificationChannel(CHANNEL_TRACK, "Enregistrement d'activité", NotificationManager.IMPORTANCE_LOW);
        track.setDescription("Activité GPS en cours");
        track.setShowBadge(false);
        manager.createNotificationChannel(steps);
        manager.createNotificationChannel(track);
    }

    /** Ouvre l'app (à l'écran indiqué par le hash) au toucher de la notification. */
    static PendingIntent openApp(Context context, String hash) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("hash", hash);
        return PendingIntent.getActivity(context, hash.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static NotificationCompat.Builder base(Context context, String channel, int icon) {
        return new NotificationCompat.Builder(context, channel)
            .setSmallIcon(icon)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
    }
}
