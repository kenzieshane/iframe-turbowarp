(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('Iframe extension must run unsandboxed.');
  }

  const vm = Scratch.vm;
  const runtime = vm.runtime;
  const extensionId = 'ksiframeTools';

  class IframeExtension {
    constructor() {
      this.iframe = null;
      this.container = null;
      this.visible = true;
      this.lastIncomingMessage = '';
      this.lastIncomingOrigin = '';
      this.state = {
        x: 0,
        y: 0,
        width: 480,
        height: 360,
        url: 'https://example.org',
        targetOrigin: 'auto'
      };

      this._onWindowMessage = this._onWindowMessage.bind(this);
      window.addEventListener('message', this._onWindowMessage);

      runtime.on('PROJECT_STOP_ALL', () => {
        this.hideIframe();
      });
    }

    getInfo() {
      return {
        id: extensionId,
        name: 'KS Iframe',
        color1: '#ff0000',
        color2: '#803737',
        blocks: [
          {
            opcode: 'createIframe',
            blockType: Scratch.BlockType.COMMAND,
            text: 'create iframe url [URL] at x [X] y [Y] width [W] height [H]',
            arguments: {
              URL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'https://example.org'
              },
              X: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              },
              Y: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              },
              W: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 480
              },
              H: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 360
              }
            }
          },
          {
            opcode: 'setIframeURL',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set iframe url [URL]',
            arguments: {
              URL: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'https://example.org'
              }
            }
          },
          {
            opcode: 'setIframePosition',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set iframe position x [X] y [Y]',
            arguments: {
              X: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              },
              Y: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              }
            }
          },
          {
            opcode: 'setIframeSize',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set iframe size width [W] height [H]',
            arguments: {
              W: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 480
              },
              H: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 360
              }
            }
          },
          {
            opcode: 'showIframe',
            blockType: Scratch.BlockType.COMMAND,
            text: 'show iframe'
          },
          {
            opcode: 'hideIframe',
            blockType: Scratch.BlockType.COMMAND,
            text: 'hide iframe'
          },
          {
            opcode: 'removeIframe',
            blockType: Scratch.BlockType.COMMAND,
            text: 'remove iframe'
          },
          {
            opcode: 'setIframeTargetOrigin',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set iframe target origin [ORIGIN]',
            arguments: {
              ORIGIN: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'auto'
              }
            }
          },
          {
            opcode: 'sendMessageToIframe',
            blockType: Scratch.BlockType.COMMAND,
            text: 'send message [MESSAGE] to iframe',
            arguments: {
              MESSAGE: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: '{"type":"PING"}'
              }
            }
          },
          {
            opcode: 'whenIframeMessageReceived',
            blockType: Scratch.BlockType.HAT,
            text: 'when iframe message received'
          },
          {
            opcode: 'iframeURL',
            blockType: Scratch.BlockType.REPORTER,
            text: 'iframe url'
          },
          {
            opcode: 'iframeTargetOrigin',
            blockType: Scratch.BlockType.REPORTER,
            text: 'iframe target origin'
          },
          {
            opcode: 'lastIframeMessage',
            blockType: Scratch.BlockType.REPORTER,
            text: 'last iframe message'
          },
          {
            opcode: 'lastIframeMessageOrigin',
            blockType: Scratch.BlockType.REPORTER,
            text: 'last iframe message origin'
          },
          {
            opcode: 'iframeVisible',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'iframe is visible?'
          }
        ]
      };
    }

    _getStageContainer() {
      const renderer = runtime.renderer;
      const canvas = renderer && renderer.canvas;
      if (!canvas || !canvas.parentElement) return null;
      return canvas.parentElement;
    }

    _ensureIframe() {
      if (this.iframe && this.iframe.isConnected) {
        return true;
      }

      this.container = this._getStageContainer();
      if (!this.container) {
        return false;
      }

      const containerStyle = window.getComputedStyle(this.container);
      if (containerStyle.position === 'static') {
        this.container.style.position = 'relative';
      }

      this.iframe = document.createElement('iframe');
      this.iframe.style.position = 'absolute';
      this.iframe.style.border = 'none';
      this.iframe.style.zIndex = '20';
      this.iframe.style.pointerEvents = 'auto';
      this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
      this.iframe.setAttribute('referrerpolicy', 'no-referrer');

      this.container.appendChild(this.iframe);
      this._applyLayout();
      return true;
    }

    _isAllowedURL(rawURL) {
      try {
        const parsed = new URL(String(rawURL).trim());
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    }

    _toFiniteNumber(value, fallback) {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    _serializeData(data) {
      if (typeof data === 'string') {
        return data;
      }

      try {
        return JSON.stringify(data);
      } catch {
        return String(data);
      }
    }

    _parseMessagePayload(rawValue) {
      const text = String(rawValue ?? '');
      const trimmed = text.trim();
      if (!trimmed) {
        return '';
      }

      const startsLikeJSON = (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      );

      if (!startsLikeJSON) {
        return text;
      }

      try {
        return JSON.parse(trimmed);
      } catch {
        return text;
      }
    }

    _defaultTargetOrigin() {
      if (!this._isAllowedURL(this.state.url)) {
        return '*';
      }

      try {
        return new URL(this.state.url).origin;
      } catch {
        return '*';
      }
    }

    _getTargetOrigin() {
      if (this.state.targetOrigin === 'auto') {
        return this._defaultTargetOrigin();
      }

      return this.state.targetOrigin || '*';
    }

    _onWindowMessage(event) {
      if (!this.iframe || !this.iframe.contentWindow) {
        return;
      }

      if (event.source !== this.iframe.contentWindow) {
        return;
      }

      const expectedOrigin = this._getTargetOrigin();
      if (expectedOrigin !== '*' && event.origin !== expectedOrigin) {
        return;
      }

      this.lastIncomingOrigin = event.origin || '';
      this.lastIncomingMessage = this._serializeData(event.data);
      runtime.startHats(`${extensionId}_whenIframeMessageReceived`);
    }

    _applyLayout() {
      if (!this.iframe || !this.container) {
        return;
      }

      const containerWidth = this.container.clientWidth || 480;
      const containerHeight = this.container.clientHeight || 360;
      const stageWidth = runtime.stageWidth || 480;
      const stageHeight = runtime.stageHeight || 360;

      const width = Math.max(1, Math.round(this.state.width));
      const height = Math.max(1, Math.round(this.state.height));

      const scaleX = containerWidth / stageWidth;
      const scaleY = containerHeight / stageHeight;

      const pxWidth = Math.round(width * scaleX);
      const pxHeight = Math.round(height * scaleY);

      const leftStage = this.state.x - width / 2;
      const topStage = stageHeight / 2 - this.state.y - height / 2;

      const leftPx = Math.round(leftStage * scaleX + containerWidth / 2);
      const topPx = Math.round(topStage * scaleY);

      this.iframe.style.left = `${leftPx}px`;
      this.iframe.style.top = `${topPx}px`;
      this.iframe.style.width = `${pxWidth}px`;
      this.iframe.style.height = `${pxHeight}px`;
      this.iframe.style.display = this.visible ? 'block' : 'none';
    }

    createIframe(args) {
      const url = String(args.URL || '').trim();
      const x = this._toFiniteNumber(args.X, 0);
      const y = this._toFiniteNumber(args.Y, 0);
      const width = this._toFiniteNumber(args.W, 480);
      const height = this._toFiniteNumber(args.H, 360);

      this.state.x = x;
      this.state.y = y;
      this.state.width = Math.max(1, width);
      this.state.height = Math.max(1, height);

      if (this._isAllowedURL(url)) {
        this.state.url = url;
      }

      if (!this._ensureIframe()) {
        return;
      }

      this.iframe.src = this.state.url;
      this.visible = true;
      this._applyLayout();
    }

    setIframeURL(args) {
      const url = String(args.URL || '').trim();
      if (!this._isAllowedURL(url)) {
        return;
      }

      this.state.url = url;
      if (!this._ensureIframe()) {
        return;
      }

      this.iframe.src = this.state.url;
    }

    setIframePosition(args) {
      this.state.x = this._toFiniteNumber(args.X, this.state.x);
      this.state.y = this._toFiniteNumber(args.Y, this.state.y);
      this._applyLayout();
    }

    setIframeSize(args) {
      this.state.width = Math.max(1, this._toFiniteNumber(args.W, this.state.width));
      this.state.height = Math.max(1, this._toFiniteNumber(args.H, this.state.height));
      this._applyLayout();
    }

    showIframe() {
      if (!this._ensureIframe()) {
        return;
      }

      this.visible = true;
      this._applyLayout();
    }

    hideIframe() {
      this.visible = false;
      this._applyLayout();
    }

    removeIframe() {
      if (this.iframe && this.iframe.parentElement) {
        this.iframe.parentElement.removeChild(this.iframe);
      }
      this.iframe = null;
    }

    setIframeTargetOrigin(args) {
      const input = String(args.ORIGIN || '').trim();

      if (!input || input.toLowerCase() === 'auto') {
        this.state.targetOrigin = 'auto';
        return;
      }

      if (input === '*') {
        this.state.targetOrigin = '*';
        return;
      }

      try {
        const parsed = new URL(input);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          this.state.targetOrigin = parsed.origin;
        }
      } catch {
      }
    }

    sendMessageToIframe(args) {
      if (!this._ensureIframe() || !this.iframe.contentWindow) {
        return;
      }

      const payload = this._parseMessagePayload(args.MESSAGE);
      const targetOrigin = this._getTargetOrigin();
      this.iframe.contentWindow.postMessage(payload, targetOrigin);
    }

    whenIframeMessageReceived() {
      return true;
    }

    iframeURL() {
      return this.state.url;
    }

    iframeTargetOrigin() {
      return this._getTargetOrigin();
    }

    lastIframeMessage() {
      return this.lastIncomingMessage;
    }

    lastIframeMessageOrigin() {
      return this.lastIncomingOrigin;
    }

    iframeVisible() {
      return !!(this.iframe && this.visible && this.iframe.style.display !== 'none');
    }
  }

  Scratch.extensions.register(new IframeExtension());
})(Scratch);
