module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Debe ser SIEMPRE el último plugin de la lista (lo exige Reanimated).
  plugins: ['react-native-reanimated/plugin'],
};
