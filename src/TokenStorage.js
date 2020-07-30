import AsyncStorage from '@react-native-community/async-storage';

export default class TokenStorage {
  key;
  constructor(key) {
    this.key = key;
  }

  saveTokens(tokens) {
    return AsyncStorage.setItem(this.key, JSON.stringify(tokens));
  }

  async loadTokens() {
    const tokens = await AsyncStorage.getItem(this.key);
    return (tokens) ? JSON.parse(tokens) : undefined;
  }

  clearTokens() {
    return AsyncStorage.removeItem(this.key);
  }
}
