package com.theentity.wiki;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CosmeticsAssetPackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
