import * as qs from 'query-string';
import { Linking } from 'react-native';
import { encode as btoa } from 'base-64';
import { getRealmURL, getLoginURL } from './Utils';
import {
  GET, POST, URL,
} from './Constants';

const basicHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded',
};

export default class {
  constructor(tokenStorage) {
    this.tokenStorage = tokenStorage;
  }

  startLoginProcess(conf, callback) {
    return new Promise(((resolve, reject) => {
      const { url, state } = getLoginURL(conf);

      const listener = event => this.onOpenURL(conf, resolve, reject, state, event);
      Linking.addEventListener(URL, listener);

      const login = callback || Linking.openURL;
      login(url);
    }));
  }

  onOpenURL(conf, resolve, reject, state, event) {
    const isRedirectUrlADeepLink = event.url.startsWith(conf.appsiteUri);

    if (isRedirectUrlADeepLink) {
      const {
        state: stateFromUrl,
        code,
      } = qs.parse(qs.extract(event.url));

      if (state === stateFromUrl) {
        this.retrieveTokens(conf, code, resolve, reject);
      }
    }
  }

  async retrieveTokens(conf, code, resolve, reject) {
    const {
      clientId, clientSecret, realm, redirectUri, url,
    } = conf;

    const tokenUrl = `${getRealmURL(realm, url)}/protocol/openid-connect/token`;
    const method = POST;

    const headers = clientSecret
      ? { ...basicHeaders, Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` }
      : basicHeaders;

    const body = qs.stringify({
      grant_type: 'authorization_code', redirect_uri: redirectUri, client_id: clientId, code,
    });

    const options = { headers, method, body };
    const fullResponse = await fetch(tokenUrl, options);
    const jsonResponse = await fullResponse.json();

    if (fullResponse.ok) {
      this.tokenStorage.saveTokens(jsonResponse);
      resolve(jsonResponse);
    } else {
      reject(jsonResponse);
    }
  }

  async retrieveUserInfo(conf) {
    const { realm, url } = conf;
    const savedTokens = await this.getTokens();

    if (savedTokens) {
      const userInfoUrl = `${getRealmURL(realm, url)}/protocol/openid-connect/userinfo`;
      const method = GET;
      const headers = { ...basicHeaders, Authorization: `Bearer ${savedTokens.access_token}` };
      const options = { headers, method };
      const fullResponse = await fetch(userInfoUrl, options);

      if (fullResponse.ok) {
        return fullResponse.json();
      }
    }
    return Promise.reject();
  }

  async refreshToken(conf) {
    const { clientId, realm, url } = conf;
    const savedTokens = await this.getTokens();

    if (!savedTokens) {
      console.warn('Missing tokens');
      return Promise.reject();
    }

    const refreshTokenUrl = `${getRealmURL(realm, url)}/protocol/openid-connect/token`;
    const method = POST;
    const body = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: savedTokens.refresh_token,
      client_id: encodeURIComponent(clientId),
    });
    const options = { headers: basicHeaders, method, body };

    const fullResponse = await fetch(refreshTokenUrl, options);
    if (fullResponse.ok) {
      const jsonResponse = await fullResponse.json();
      this.tokenStorage.saveTokens(jsonResponse);
      return jsonResponse;
    }

    return Promise.reject();
  }

  async logoutKc(conf) {
    const { realm, url } = conf;
    const savedTokens = await this.getTokens();
    if (!savedTokens) {
      console.warn('Token is undefined');
      return Promise.reject();
    }

    const logoutUrl = `${getRealmURL(realm, url)}/protocol/openid-connect/logout`;
    const method = GET;
    const options = { headers: basicHeaders, method };
    const fullResponse = await fetch(logoutUrl, options);

    if (fullResponse.ok) {
      this.tokenStorage.clearTokens();
      return true;
    }
    console.error('Error during kc-logout: ', fullResponse);
    return false;
  }


  getTokens() {
    return this.tokenStorage.loadTokens();
  }
}
