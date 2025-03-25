const Footer = () => {
  return (
    <footer className="bg-white border-t text-sm text-gray-600">
  <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div>
      <p className="font-semibold text-pink-600">InstaBot</p>
      <p>Helping you manage your Instagram followers easily and safely.</p>
    </div>
    <div>
      <p className="font-semibold mb-1">Links</p>
      <ul className="space-y-1">
        <li><a href="/privacy" className="hover:text-pink-500">Privacy Policy</a></li>
        <li><a href="/terms" className="hover:text-pink-500">Terms of Use</a></li>
        <li><a href="/contact" className="hover:text-pink-500">Contact</a></li>
      </ul>
    </div>
    <div className="text-sm text-gray-500">
      <p>© {new Date().getFullYear()} InstaBot. All rights reserved.</p>
      <p>Version 1.0.0 · Built with 💖 using Django, React, Tailwind</p>
    </div>
  </div>
</footer>

  );
};

export default Footer;
