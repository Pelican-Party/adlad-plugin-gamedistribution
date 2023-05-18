interface Window {
	GD_OPTIONS?: {
		gameId: string;
		onEvent(event: GdEvent);
	};
	gdsdk: {
		showAd(type?: GdAdType, displayOptions?: GdDisplayOptions);
		openConsole();
		AdType: GdAdTypeEnum;
	};
}

type GdAdTypeEnum = {
	Display: "display";
	Interstitial: "interstitial";
	Rewarded: "rewarded";
};
type GdAdType = GdAdTypeEnum[keyof GdAdTypeEnum];

interface GdDisplayOptions {
	containerId: string;
}

interface GdEvent {
	name: "SDK_READY" | "SDK_GAME_START" | "SDK_GAME_PAUSE" | "SDK_REWARDED_WATCH_COMPLETE" | "IMPRESSION";
}
