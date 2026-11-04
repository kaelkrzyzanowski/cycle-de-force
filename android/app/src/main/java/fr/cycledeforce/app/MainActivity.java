package fr.cycledeforce.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /** Toucher une notification (enregistrement en cours…) avec l'app déjà ouverte : aller à l'écran indiqué. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String hash = intent.getStringExtra("hash");
        if (hash != null && hash.startsWith("#/") && getBridge() != null) {
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript("location.hash = " + JSONObject.quote(hash), null));
        }
    }
}
