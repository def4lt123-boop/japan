let path = '/';
let params = {};
exports.__esModule = true;
exports.setPath = (p) => {
  path = p;
  const parts = p.split('/').filter(Boolean);
  params = parts[0] === 't' ? { tripId: parts[1] } : {};
};
exports.usePathname = () => path;
exports.useParams = () => params;
exports.useSearchParams = () => new URLSearchParams();
exports.useRouter = () => ({ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} });
exports.useSelectedLayoutSegment = () => null;
exports.notFound = () => { throw new Error('notFound()'); };
exports.redirect = (to) => { throw new Error('redirect(' + to + ')'); };
exports.default = exports;
