interface Window {
	GD_OPTIONS?: {
		gameId: string;
		onEvent(event: GdEvent);
	};
	gdsdk: {
		showAd(type?: "interstitial" | "rewarded");
		openConsole();
	};
}

interface GdEvent {
	name: "SDK_READY" | "SDK_GAME_START" | "SDK_GAME_PAUSE" | "SDK_REWARDED_WATCH_COMPLETE" | "IMPRESSION";
}
