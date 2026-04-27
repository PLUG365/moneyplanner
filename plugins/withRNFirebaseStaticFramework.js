const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RNFIREBASE_STATIC_FRAMEWORK_LINE = "$RNFirebaseAsStaticFramework = true";

module.exports = function withRNFirebaseStaticFramework(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (!podfile.includes(RNFIREBASE_STATIC_FRAMEWORK_LINE)) {
        const insertionPattern = /platform :ios, .*\n/;
        if (!insertionPattern.test(podfile)) {
          throw new Error("Unable to find iOS platform line in Podfile");
        }

        podfile = podfile.replace(insertionPattern, (match) => {
          return `${match}${RNFIREBASE_STATIC_FRAMEWORK_LINE}\n`;
        });
        fs.writeFileSync(podfilePath, podfile);
      }

      return modConfig;
    },
  ]);
};
