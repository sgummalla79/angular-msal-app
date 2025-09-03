export const environment = {
  production: false,
  msalConfig: {
    auth: {
      clientId: 'b312a0ef-4376-43b9-866f-b1baf02e84d7',
      authority: 'https://login.microsoftonline.com/consumers',
      redirectUri: 'http://localhost:8080',
      postLogoutRedirectUri: 'http://localhost:8080'
    }
  }
};