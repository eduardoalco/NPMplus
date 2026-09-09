import dnsPlugins from "../certbot/dns-plugins.json" with { type: "json" };
import { certbot as logger } from "../logger.js";
import errs from "./error.js";
import utils from "./utils.js";

const certbotRuntimePackages = ["certbot==5.8.0", "josepy==2.2.0"];

/**
 * Installs a certbot plugin given the key for the object from
 * ../certbot/dns-plugins.json
 *
 * @param   {string}  pluginKey
 * @returns {Object}
 */
const installPlugin = async (pluginKey) => {
	if (typeof dnsPlugins[pluginKey] === "undefined") {
		// throw Error(`Certbot plugin ${pluginKey} not found`);
		throw new errs.ItemNotFoundError(pluginKey);
	}

	const plugin = dnsPlugins[pluginKey];
	const installArgs = ["install", "--upgrade", "--no-cache-dir"];
	logger.start(`Installing ${pluginKey}...`);

	if (plugin.dependencies) {
		await utils.execFile("pip", [...installArgs, ...certbotRuntimePackages, ...plugin.dependencies]);
	}

	const result = await utils.execFile("pip", [
		...installArgs,
		...(plugin.install_args || []),
		...certbotRuntimePackages,
		plugin.package_name,
	]);
	await utils.execFile("python", ["-c", "import certbot.main, josepy"]);

	logger.complete(`Installed ${pluginKey}`);
	return result;
};

/**
 * @param {array} pluginKeys
 */
const installPlugins = async (pluginKeys) => {
	if (pluginKeys.length === 0) {
		return;
	}

	let hasErrors = false;

	for (const pluginKey of pluginKeys) {
		try {
			await installPlugin(pluginKey);
		} catch (err) {
			hasErrors = true;
			logger.error(err.message);
			break;
		}
	}

	if (hasErrors) {
		throw new errs.CommandError("Some plugins failed to install. Please check the logs above", 1);
	}
};

export { installPlugin, installPlugins };
