import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { PINBOARD_HTML } from './pinboardHtml';

export interface BoardData {
  cards: { id: string; taskId: string; x: number; y: number; color?: string | null }[];
  connections: { id: string; aTaskId: string; bTaskId: string; label: string }[];
  tasks: Record<
    string,
    { title: string; status: string; priority?: string; startDate?: string; dueDate?: string; body?: string }
  >;
  bgColor?: string | null;
}

export interface PinboardWebViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface Props {
  data: BoardData;
  onMove: (cardId: string, x: number, y: number) => void;
  onConnect: (fromTaskId: string, toTaskId: string) => void;
  onRelabel: (connId: string, label: string) => void;
  onDisconnect: (connId: string) => void;
  onUnpin: (cardId: string) => void;
  onOpen: (taskId: string) => void;
  onRecolor: (cardId: string, color: string) => void;
  onBoardColor: (color: string) => void;
}

const PinboardWebView = forwardRef<PinboardWebViewHandle, Props>((props, ref) => {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const dataRef = useRef(props.data);
  dataRef.current = props.data;

  const inject = (js: string) => webRef.current?.injectJavaScript(js + '; true;');

  const pushBoard = () => {
    if (!readyRef.current) return;
    inject('window.__setBoard(' + JSON.stringify(dataRef.current) + ')');
  };

  // Re-inject whenever the board data changes (pin / unpin / connect / move commit).
  React.useEffect(() => {
    pushBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.data]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => inject('window.__zoom(1.2)'),
    zoomOut: () => inject('window.__zoom(1/1.2)'),
    reset: () => inject('window.__reset()'),
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'ready':
        readyRef.current = true;
        pushBoard();
        break;
      case 'move':
        props.onMove(msg.cardId, msg.x, msg.y);
        break;
      case 'connect':
        props.onConnect(msg.fromTaskId, msg.toTaskId);
        break;
      case 'relabel':
        props.onRelabel(msg.connId, msg.label);
        break;
      case 'disconnect':
        props.onDisconnect(msg.connId);
        break;
      case 'unpin':
        props.onUnpin(msg.cardId);
        break;
      case 'open':
        props.onOpen(msg.taskId);
        break;
      case 'recolor':
        props.onRecolor(msg.cardId, msg.color ?? '');
        break;
      case 'boardColor':
        props.onBoardColor(msg.color ?? '');
        break;
    }
  };

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: PINBOARD_HTML }}
      onMessage={onMessage}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
});

PinboardWebView.displayName = 'PinboardWebView';

export default PinboardWebView;
