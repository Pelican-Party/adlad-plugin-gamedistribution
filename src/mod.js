/**
 * @param {Object} options
 * @param {string} options.gameId
 * @param {boolean} [options.debug]
 */
export function gameDistributionPlugin({
	gameId,
	debug,
}) {
	/** @type {() => void} */
	let resolveInitialize;
	let rewardReceived = false;
	let didShowAd = false;

	if (debug === undefined) {
		// Checking if the location contains 'localhost' rather than being exactly 'localhost' allows
		// developers to map domains like 'localhost.example.com' to 127.0.0.1.
		// In the unlikely case where a production domain actually contains 'localhost', the developer
		// can explicitly set debug to false.
		debug = location.hostname.includes("localhost");
	}

	/**
	 * Calls `showAd` on the gdsdk but makes sure the promise is resolved once a timeout is reached.
	 * @param {GdAdType} type
	 * @returns {Promise<import("$adlad").ShowFullScreenAdResult?>} A result if the ad failed for a specific reason
	 * or null if it is not known whether an ad was shown or not.
	 */
	async function safeShowAd(type) {
		didShowAd = false;
		/** @returns {Promise<import("$adlad").ShowFullScreenAdResult?>} */
		const showAd = async () => {
			try {
				await window.gdsdk.showAd(type);
			} catch (e) {
				if (e == "The advertisement was requested too soon.") {
					// Yes they are litterally throwing a string.
					return {
						didShowAd: false,
						errorReason: "time-constraint",
					};
				}

				// AdLad will handle errors for us
				throw e;
			}
			return null;
		};
		const showAdPromise = showAd();

		// When an ad error occurs (on localhost for exmaple), it's possible for `showAd()` to never resolve.
		// https://github.com/GameDistribution/GD-HTML5/issues/208
		// To work around this, we'll add a timeout.
		// If the 'IMPRESSION' event hasn't fired before this timeout, we'll resolve the promise with an 'unknown' errorReason.
		// It's important that we resolve the `showFullScreenAd` and `showRewardedAd` promises since these
		// control the state of `needsPause`. If we don't resolve these, the game will be hard locked in a paused state forever.
		/** @type {Promise<import("$adlad").ShowFullScreenAdResult?>} */
		const timeoutPromise = new Promise((resolve) => {
			setTimeout(() => {
				if (didShowAd) {
					// The "IMPRESSION" has fired.
					// At this point an ad has been loaded. Since the timeout is only supposed to handle the case
					// where no ad loads at all, let's just hope the sdk will resolve the promise for us at this point.
				} else {
					resolve({
						didShowAd: false,
						errorReason: "unknown",
					});
				}
			}, 5_000);
		});

		const showAdResult = await Promise.race([showAdPromise, timeoutPromise]);

		// The sdk as supposed to have fired both SDK_GAME_PAUSE and SDK_GAME_START (or neither)
		// buuuut of course there is a chance that only SDK_GAME_PAUSE fires without SDK_GAME_START ever firing
		// to make the game unpause again. This seems to happen when running the sdk on localhost.
		// So just to make sure games are resumed, we'll set needsPause and needsMute back to false here.
		if (pluginContext) {
			pluginContext.setNeedsMute(false);
			pluginContext.setNeedsPause(false);
		}

		return showAdResult;
	}

	/** @type {import("$adlad").AdLadPluginInitializeContext?} */
	let pluginContext = null;

	/** @type {import("$adlad").AdLadPlugin} */
	const plugin = {
		name: "gamedistribution",
		async initialize(ctx) {
			if (window.GD_OPTIONS) {
				throw new Error("GameDistribution plugin is being initialized more than once");
			}

			pluginContext = ctx;

			window.GD_OPTIONS = {
				gameId,
				onEvent(event) {
					if (event.name == "SDK_READY") {
						resolveInitialize();
					} else if (event.name == "SDK_GAME_PAUSE") {
						ctx.setNeedsPause(true);
						ctx.setNeedsMute(true);
					} else if (event.name == "SDK_GAME_START") {
						ctx.setNeedsMute(false);
						ctx.setNeedsPause(false);
					} else if (event.name == "SDK_REWARDED_WATCH_COMPLETE") {
						rewardReceived = true;
					} else if (event.name == "IMPRESSION") {
						didShowAd = true;
					}
				},
			};

			const sdkUrl = "https://html5.api.gamedistribution.com/main.min.js";
			await import(sdkUrl);
			/** @type {Promise<void>} */
			const promise = new Promise((resolve) => {
				resolveInitialize = resolve;
			});
			await promise;

			if (debug) {
				// Calling openConsole multiple times makes the console unresponsive:
				// https://github.com/GameDistribution/GD-HTML5/issues/207
				// But the sdk remembers if it has been called before and automatically opens on page load.
				// To work around this we check if it has the 'gd_debug_ex' localStorage flag has been set.
				// This is not a public api but it's the best we can do.
				if (!localStorage.gd_debug_ex) {
					window.gdsdk.openConsole();
				}
			}
		},
		manualNeedsMute: true,
		manualNeedsPause: true,
		async showFullScreenAd() {
			const result = await safeShowAd(window.gdsdk.AdType.Interstitial);
			if (result) {
				return result;
			}
			return {
				didShowAd,
				errorReason: null,
			};
		},
		async showRewardedAd() {
			rewardReceived = false;
			const result = await safeShowAd(window.gdsdk.AdType.Rewarded);
			if (result) return result;
			return {
				didShowAd: rewardReceived,
				errorReason: null,
			};
		},
		showBannerAd(options) {
			window.gdsdk.showAd(window.gdsdk.AdType.Display, {
				containerId: options.id,
			});
		},
	};

	return plugin;
}
