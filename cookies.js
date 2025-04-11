const cookies = document.cookie
  .split('; ')
  .map(c => {
    const [name, ...rest] = c.split('=');
    return {
      name,
      value: rest.join('='),
      domain: '.instagram.com',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'Strict'
    };
  });

console.log(JSON.stringify({
  cookies,
  profile_url: window.location.href
}, null, 2));
