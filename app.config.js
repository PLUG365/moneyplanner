module.exports = ({ config }) => {
  const plugins = [
    ...(config.plugins ?? []),
    "./plugins/withRNFirebaseStaticFramework",
  ];

  return {
    ...config,
    plugins,
    ios: {
      ...config.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
    },
  };
};
