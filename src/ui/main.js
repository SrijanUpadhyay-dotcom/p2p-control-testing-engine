import { html, render } from 'htm/preact';
import { App } from './app.js';
import './styles.css';

render(html`<${App} />`, document.getElementById('app'));
