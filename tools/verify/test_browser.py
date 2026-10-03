import urllib.request, json, websocket, time

try:
    req = urllib.request.urlopen('http://localhost:9222/json')
    tabs = json.loads(req.read().decode('utf-8'))
    tab = next(t for t in tabs if t['type'] == 'page')
    ws_url = tab['webSocketDebuggerUrl']
    
    ws = websocket.create_connection(ws_url)
    
    # Enable domains
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.enable'}))
    ws.send(json.dumps({'id': 2, 'method': 'Log.enable'}))
    
    # Execute a click on the first character card
    js_code = '''
        let card = document.querySelector('.char-card');
        if(card) {
            console.log('Clicking card...');
            card.click();
        } else {
            console.log('No char card found!');
        }
    '''
    ws.send(json.dumps({
        'id': 3,
        'method': 'Runtime.evaluate',
        'params': {'expression': js_code}
    }))
    
    # Listen for messages for 3 seconds
    start = time.time()
    while time.time() - start < 3:
        ws.settimeout(0.5)
        try:
            msg = json.loads(ws.recv())
            if msg.get('method') == 'Runtime.consoleAPICalled':
                args = msg['params'].get('args', [])
                texts = [a.get('value', a.get('description', '')) for a in args]
                print('CONSOLE:', ' '.join(str(t) for t in texts))
            elif msg.get('method') == 'Runtime.exceptionThrown':
                exc = msg['params']['exceptionDetails']
                print('EXCEPTION:', exc.get('text'), exc.get('exception', {}).get('description'))
        except websocket.WebSocketTimeoutException:
            pass
            
    ws.close()
except Exception as e:
    print('Failed:', e)
