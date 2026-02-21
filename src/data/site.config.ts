export const siteConfig = {
    name: 'Mississippi Sports',
    tagline: 'Your Source for Mississippi Sports',
    description:
        'High school and college sports coverage from across Mississippi. Download the Mississippi Sports app for scores, news, and more.',
    url: 'https://mississippisportsapp.com',
    appStore: {
        url: 'https://apps.apple.com/us/app/mississippi-sports/id6758892239',
        appId: '6758892239',
    },
    newsletter: {
        url: 'https://mississippinewsgroup.substack.com/',
    },
    contact: {
        email: 'editor@sportsmississippi.com',
    },
    social: {
        facebook: 'https://www.facebook.com/mississippisports',
        twitter: 'https://x.com/SocialSportsMs',
    },
    seo: {
        title: 'Mississippi Sports App | High School & College Sports in Mississippi',
        keywords: [
            'Mississippi high school sports',
            'Mississippi sports news',
            'Mississippi football scores',
            'Mississippi basketball news',
            'Tippah County sports',
            'Desoto County sports',
            'Download Mississippi Sports app',
            'Mississippi college sports',
            'Mississippi sports app',
        ],
    },
    founder: {
        name: 'Jon Ross Myers',
        title: 'Founder & Editor',
        yearFounded: 2006,
    },
} as const;
