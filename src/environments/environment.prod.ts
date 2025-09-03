export const environment = {
  production: true,
  msalConfig: {
    auth: {
      clientId: 'b312a0ef-4376-43b9-866f-b1baf02e84d7', // Same as development
      authority: 'https://login.microsoftonline.com/consumers',
      redirectUri: 'https://angular-msal-app.azurewebsites.net', // Update this
      postLogoutRedirectUri: 'https://angular-msal-app.azurewebsites.net'
    }
  }
};