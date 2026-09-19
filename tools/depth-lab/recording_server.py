"""Serve the hand guide without restarting the privileged camera reader."""
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from server import Handler


class RecordingHandler(Handler):
    def proxy(self):
        if not self.local():
            return self.reply({'error':'Invalid host'},403)
        try:
            body = None
            if self.command == 'POST':
                origin = self.headers.get('Origin')
                if origin and origin != 'http://'+self.headers.get('Host'):
                    return self.reply({'error':'Invalid origin'},403)
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size < 4096 or self.headers.get('Content-Type') != 'application/json':
                    raise ValueError('Invalid request')
                body = self.rfile.read(size)
            req = urllib.request.Request('http://127.0.0.1:8769'+self.path, data=body,
                headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req, timeout=3) as r:
                return self.reply(r.read(), mime='application/json')
        except (OSError, ValueError) as exc:
            return self.reply({'error':'相机服务未就绪：'+str(exc)},502)

    def do_GET(self):
        if self.path == '/api/state':
            return self.proxy()
        if self.path == '/':
            self.path = '/hands'
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/calibrate':
            return self.proxy()
        if not self.path.startswith(('/api/record/', '/api/compare/')) and self.path != '/api/interaction':
            return self.reply({'error':'请在原深度测试台调整设备'},403)
        super().do_POST()


if __name__ == '__main__':
    print('手部测试与自动记录 http://127.0.0.1:8773/hands', flush=True)
    ThreadingHTTPServer(('127.0.0.1',8773), RecordingHandler).serve_forever()
