import { Login } from './Login';
import { TokenStorage } from './TokenStorage';
import { URL_EVENT } from './Constants';

const login = new Login();
login.setTokenStorage(new TokenStorage('react-native-keycloak-tokens'));

export default login;
export { URL_EVENT };
