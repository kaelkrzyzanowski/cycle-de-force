package fr.cycledeforce.app;

import android.Manifest;
import android.content.Context;
import android.location.LocationManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Iterator;
import org.json.JSONArray;
import org.json.JSONObject;

/** Podomètre et enregistrement GPS, exposés à l'app web (src/platform/tracker.ts). */
@CapacitorPlugin(
    name = "Tracker",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }),
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class TrackerPlugin extends Plugin {

    // ——— Podomètre ———

    /** Avant Android 10, compter les pas ne demande aucune autorisation. */
    private boolean activityGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || getPermissionState("activity") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void stepStatus(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("available", StepCounterService.isAvailable(context));
        result.put("granted", activityGranted());
        result.put("enabled", StepStore.isEnabled(context));
        call.resolve(result);
    }

    @PluginMethod
    public void startSteps(PluginCall call) {
        if (!StepCounterService.isAvailable(getContext())) {
            call.reject("Pas de podomètre sur ce téléphone", "NO_SENSOR");
            return;
        }
        if (!activityGranted()) {
            requestPermissionForAlias("activity", call, "afterActivityPermission");
            return;
        }
        askNotificationsThen(call, "afterStepNotifications");
    }

    @PermissionCallback
    private void afterActivityPermission(PluginCall call) {
        if (!activityGranted()) {
            call.reject("Autorisation « activité physique » refusée", "DENIED");
            return;
        }
        askNotificationsThen(call, "afterStepNotifications");
    }

    @PermissionCallback
    private void afterStepNotifications(PluginCall call) {
        // Sans notifications, le service tourne quand même (notification masquée).
        StepStore.setEnabled(getContext(), true);
        StepCounterService.start(getContext());
        JSObject result = new JSObject();
        result.put("enabled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopSteps(PluginCall call) {
        StepStore.setEnabled(getContext(), false);
        StepCounterService.stop(getContext());
        call.resolve();
    }

    /** Relance le service au démarrage de l'app s'il a été arrêté (mise à jour, système). */
    @PluginMethod
    public void ensureSteps(PluginCall call) {
        Context context = getContext();
        if (StepStore.isEnabled(context) && activityGranted() && StepCounterService.isAvailable(context)) {
            StepCounterService.start(context);
        }
        call.resolve();
    }

    @PluginMethod
    public void getSteps(PluginCall call) {
        JSONObject days = StepStore.days(getContext());
        JSObject out = new JSObject();
        for (Iterator<String> it = days.keys(); it.hasNext(); ) {
            String day = it.next();
            out.put(day, days.optInt(day, 0));
        }
        JSObject result = new JSObject();
        result.put("days", out);
        call.resolve(result);
    }

    // ——— Enregistrement GPS ———

    @PluginMethod
    public void startTrack(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "afterLocationPermission");
            return;
        }
        askNotificationsThen(call, "afterTrackNotifications");
    }

    @PermissionCallback
    private void afterLocationPermission(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Autorisation de localisation refusée", "DENIED");
            return;
        }
        askNotificationsThen(call, "afterTrackNotifications");
    }

    @PermissionCallback
    private void afterTrackNotifications(PluginCall call) {
        LocationManager locations = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (locations == null || !locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("La localisation du téléphone est désactivée", "GPS_OFF");
            return;
        }
        TrackStore.clear(getContext());
        TrackService.send(getContext(), TrackService.ACTION_START, call.getString("title", "Activité"), 0);
        call.resolve();
    }

    @PluginMethod
    public void pauseTrack(PluginCall call) {
        if (TrackService.isRecording(getContext())) TrackService.send(getContext(), TrackService.ACTION_PAUSE, null, 0);
        call.resolve();
    }

    @PluginMethod
    public void resumeTrack(PluginCall call) {
        if (TrackService.isRecording(getContext())) {
            TrackService.send(getContext(), TrackService.ACTION_RESUME, null, call.getLong("elapsedMs", 0L));
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTrack(PluginCall call) {
        TrackService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearTrack(PluginCall call) {
        TrackService.stop(getContext());
        TrackStore.clear(getContext());
        call.resolve();
    }

    /** Points depuis l'indice `from` : [lat, lon, t, seg, précision]. */
    @PluginMethod
    public void getTrack(PluginCall call) {
        int from = call.getInt("from", 0);
        JSArray points = new JSArray();
        for (double[] p : TrackStore.since(getContext(), from)) {
            JSONArray row = new JSONArray();
            try {
                row.put(p[0]).put(p[1]).put((long) p[2]).put((int) p[3]).put(p[4]);
            } catch (org.json.JSONException ignored) {
                continue;
            }
            points.put(row);
        }
        JSObject result = new JSObject();
        result.put("points", points);
        result.put("recording", TrackService.isRecording(getContext()));
        result.put("paused", TrackService.isPaused(getContext()));
        call.resolve(result);
    }

    // ——— Commun ———

    /** Android 13+ : demande l'autorisation d'afficher la notification du service, puis continue dans `callback`. */
    private void askNotificationsThen(PluginCall call, String callback) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, callback);
        } else if ("afterStepNotifications".equals(callback)) {
            afterStepNotifications(call);
        } else {
            afterTrackNotifications(call);
        }
    }
}
