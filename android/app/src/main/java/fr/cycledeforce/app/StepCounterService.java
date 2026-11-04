package fr.cycledeforce.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.IBinder;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.text.NumberFormat;
import java.util.Locale;

/** Podomètre en arrière-plan : écoute le compteur de pas matériel (très économe) et tient les totaux du jour. */
public class StepCounterService extends Service implements SensorEventListener {

    /** Regroupement des relevés par le capteur : la batterie est épargnée, le total reste exact. */
    private static final int MAX_REPORT_LATENCY_US = 30_000_000;
    private static final long NOTIFY_EVERY_MS = 5_000;

    private SensorManager sensors;
    private Sensor counter;
    private boolean listening;
    private long lastNotify;
    private int shown = -1;

    static boolean isAvailable(Context context) {
        SensorManager manager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        return manager != null && manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    static void start(Context context) {
        ContextCompat.startForegroundService(context, new Intent(context, StepCounterService.class));
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, StepCounterService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Notifications.ensureChannels(this);
        sensors = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        counter = sensors == null ? null : sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            ServiceCompat.startForeground(this, Notifications.ID_STEPS, notification(StepStore.todaySteps(this)),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } catch (RuntimeException e) {
            // Permission « activité physique » retirée entre-temps : le service ne peut pas tourner.
            stopSelf();
            return START_NOT_STICKY;
        }
        if (counter == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!listening) {
            listening = sensors.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL, MAX_REPORT_LATENCY_US);
        }
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        int today = StepStore.record(this, (long) event.values[0]);
        long now = System.currentTimeMillis();
        if (today != shown && now - lastNotify >= NOTIFY_EVERY_MS) {
            lastNotify = now;
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(Notifications.ID_STEPS, notification(today));
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private Notification notification(int steps) {
        shown = steps;
        String text = NumberFormat.getIntegerInstance(Locale.FRANCE).format(steps) + " pas aujourd'hui";
        return Notifications.base(this, Notifications.CHANNEL_STEPS, R.drawable.ic_stat_steps)
            .setContentTitle(text)
            .setContentIntent(Notifications.openApp(this, "#/aujourdhui"))
            .setShowWhen(false)
            .build();
    }

    @Override
    public void onDestroy() {
        if (listening && sensors != null) sensors.unregisterListener(this);
        listening = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
