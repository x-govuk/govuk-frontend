(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define('GOVUKFrontend', ['exports'], factory) :
	(factory((global.GOVUKFrontend = {})));
}(this, (function (exports) { 'use strict';

	/*
	 * This variable is automatically overwritten during builds and releases.
	 * It doesn't need to be updated manually.
	 */

	/**
	 * GOV.UK Frontend release version
	 *
	 * {@link https://github.com/alphagov/govuk-frontend/releases}
	 */
	var version = '4.6.0';

	exports.version = version;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=govuk-frontend-version.js.map
