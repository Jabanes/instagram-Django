import { Instagram } from 'lucide-react';
import React from 'react';

const Footer = ({ onTermsClick }: { onTermsClick: () => void }) => {
  return (
    <footer className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-pink-200 text-sm text-gray-800 shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Logo + Description */}
        <div className="text-center sm:text-left">
          <a href='/' className="font-bold text-pink-600 text-base">InstaBot</a>
          <p className="text-xs text-gray-600">Automate your Instagram cleanup</p>
        </div>

        {/* Links */}
        <ul className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
          <li><a href="/privacy-policy" className="hover:text-pink-500">Privacy Policy</a></li>
          <li><button onClick={onTermsClick} className="hover:text-pink-500 underline">Terms of Use</button></li>
          <li><a href="mailto:erezhabani2003@gmail.com" className="hover:text-pink-500">Contact</a></li>
        </ul>

        {/* Contact & Rights */}
        <div className="text-center sm:text-right text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-center sm:justify-end gap-2">

          <p className="text-xs text-gray-400 mt-1">© All rights reserved to <span className="font-bold text-black-500">Erez Habani</span>.</p>
            <a href="https://www.instagram.com/erez.habani/" target="_blank" rel="noopener noreferrer" className="hover:text-pink-600">
              <Instagram className="text-pink-500 w-4 h-4" />
            </a>
          </div>
          <p>Email: <a href="mailto:erezhabani2003@gmail.com" className="text-pink-500 hover:underline">erezhabani2003@gmail.com</a></p>
          
          
        </div>
      </div>
    </footer>
  );
};

export default Footer;
