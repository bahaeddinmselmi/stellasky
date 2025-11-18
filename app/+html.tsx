import React from 'react';
import * as RouterHtml from 'expo-router/html';

const Html = (RouterHtml as any).Html as React.ComponentType<any>;
const Head = (RouterHtml as any).Head as React.ComponentType<any>;
const Main = (RouterHtml as any).Main as React.ComponentType<any>;
const NextScript = (RouterHtml as any).NextScript as React.ComponentType<any>;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta name="theme-color" content="#0a0a2a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
