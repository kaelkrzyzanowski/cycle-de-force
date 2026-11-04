package fr.cycledeforce.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

/** Relance le podomètre après un redémarrage du téléphone ou une mise à jour de l'app. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        if (!StepStore.isEnabled(context) || !StepCounterService.isAvailable(context)) return;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        if (!granted) return;
        try {
            StepCounterService.start(context);
        } catch (RuntimeException ignored) {
            // démarrage refusé par le système : le service repartira à la prochaine ouverture de l'app
        }
    }
}
