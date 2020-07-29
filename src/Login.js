import * as querystring from 'query-string';
import { Linking } from 'react-native';
import uuidv4 from 'uuid/v4';
import { URL_EVENT, URL } from './Constants';
import {decode as atob, encode as btoa} from 'base-64'

export class Login {
    state;
    conf;
    tokenStorage;

    constructor() {
      this.state = {};
      this.onOpenURL = this.onOpenURL.bind(this);
      Linking.addEventListener(URL, this.onOpenURL);

      this.props = {
        requestOptions: {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'GET',
          body: undefined,
        },
        url: '',
      };
    }

    getTokens() {
      return this.tokenStorage.loadTokens();
    }

    startLoginProcess(conf, emitter) {
      this.setConf(conf);
      return new Promise(((resolve, reject) => {
        const { url, state } = this.getLoginURL();
        this.state = {
          ...this.state,
          resolve,
          reject,
          state,
        };

        if (emitter && emitter.emit) {
          emitter.emit(URL_EVENT, url);
        } else {
          Linking.openURL(url);
        }
      }));
    }

    setConf(conf) {
      if (conf) {
        this.conf = conf;
      }
    }

    async logoutKc() {
      const { clientId } = this.conf;
      const savedTokens = await this.getTokens();
      if (!savedTokens) {
        return undefined;
      }

      this.props.url = `${this.getRealmURL()}/protocol/openid-connect/logout`;

      this.setRequestOptions(
        'POST',
        querystring.stringify({ client_id: clientId, refresh_token: savedTokens.refresh_token }),
      );

      const fullResponse = await fetch(this.props.url, this.props.requestOptions);

      if (fullResponse.ok) {
        this.tokenStorage.clearTokens();
        return true;
      }
      return false;
    }

    onOpenURL(event) {
      if (event.url.startsWith(this.conf.appsiteUri)) {
        const {
          state,
          code,
        } = querystring.parse(querystring.extract(event.url));
        if (this.state.state === state) {
          this.retrieveTokens(code);
        }
      }
    }


    async retrieveTokens(code) {
      const { redirectUri, clientId } = this.conf;
      this.props.url = `${this.getRealmURL()}/protocol/openid-connect/token`;

      this.setRequestOptions(
        'POST',
        querystring.stringify({
          grant_type: 'authorization_code', redirect_uri: redirectUri, client_id: clientId, code,
        }),
      );

      if(this.conf.clientSecret) {
        this.setHeader('Authorization', 'Basic ' + btoa(this.conf.clientId + ':' + this.conf.clientSecret));
      }
      const fullResponse = await fetch(this.props.url, this.props.requestOptions);
      const jsonResponse = await fullResponse.json();
      if (fullResponse.ok) {
        this.tokenStorage.saveTokens(jsonResponse);
        this.state.resolve(jsonResponse);
      } else {
        this.state.reject(jsonResponse);
      }
    }

    async retrieveUserInfo() {
      const savedTokens = await this.getTokens();
      if (savedTokens) {
        this.props.url = `${this.getRealmURL()}/protocol/openid-connect/userinfo`;

        this.setHeader('Authorization', `Bearer ${savedTokens.access_token}`);
        this.setRequestOptions('GET');

        const fullResponse = await fetch(this.props.url, this.props.requestOptions);
        if (fullResponse.ok) {
          return fullResponse.json();
        }
      }
      return undefined;
    }

    async refreshToken() {
      const savedTokens = await this.getTokens();
      if (!savedTokens) {
        return undefined;
      }

      const { clientId } = this.conf;
      this.props.url = `${this.getRealmURL()}/protocol/openid-connect/token`;

      this.setRequestOptions('POST', querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: savedTokens.refresh_token,
        client_id: encodeURIComponent(clientId),
      }));

      const fullResponse = await fetch(this.props.url, this.props.requestOptions);
      if (fullResponse.ok) {
        const jsonResponse = await fullResponse.json();
        this.tokenStorage.saveTokens(jsonResponse);
        return jsonResponse;
      }
      return undefined;
    }

    getRealmURL() {
      const { url, realm } = this.conf;
      const slash = url.endsWith('/') ? '' : '/';
      return `${url + slash}realms/${encodeURIComponent(realm)}`;
    }

    getLoginURL() {
      const {
        redirectUri, clientId, kcIdpHint, options,
      } = this.conf;
      const responseType = 'code';
      const state = uuidv4();
      const scope = 'openid';
      const url = `${this.getRealmURL()}/protocol/openid-connect/auth?${querystring.stringify({
        scope,
        kc_idp_hint: kcIdpHint,
        redirect_uri: redirectUri,
        client_id: clientId,
        response_type: responseType,
        options,
        state,
      })}`;

      return {
        url,
        state,
      };
    }

    setTokenStorage(tokenStorage) {
      this.tokenStorage = tokenStorage;
    }

    setRequestOptions(method, body) {
      this.props.requestOptions = {
        ...this.props.requestOptions,
        method,
        body,
      };
    }

    setHeader(key, value) {
      this.props.requestOptions.headers[key] = value;
    }
}
