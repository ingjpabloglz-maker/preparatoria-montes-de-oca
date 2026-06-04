const PUBLIC_PAGES = ['LandingPage', 'Login', 'Register', 'ForgotPassword', 'ResetPassword', 'LegalPage', 'legal', 'terms', 'privacy-policy'];

export function createPageUrl(pageName: string) {
    const cleanName = pageName.replace(/ /g, '-');
    const pathPart = cleanName.split('?')[0].split('#')[0];

    if (PUBLIC_PAGES.includes(pathPart)) {
        return '/' + cleanName;
    }
    return '/app/' + cleanName;
}