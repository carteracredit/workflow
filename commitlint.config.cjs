/** @type {import("@commitlint/types").UserConfig} */
module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"header-max-length": [2, "always", 200],
		"max-body-line-length": [0, "always", 100],
	},
};
