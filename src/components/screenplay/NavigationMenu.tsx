import React from 'react';

interface NavigationMenuProps {
  menuItems: string[];
  isDarkMode: boolean;
  t: (key: string) => string;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  menuItems,
  isDarkMode,
  t,
}) => {
  return (
    <nav className="flex items-center space-x-2">
      {menuItems.map((item) => (
        <button
          key={item}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200
            ${
              isDarkMode
                ? 'text-[#F5F5F2] hover:bg-[#577B92]/20'
                : 'text-[#1E4D3A] hover:bg-[#577B92]/10'
            }`}
        >
          {t(item)}
        </button>
      ))}
    </nav>
  );
};

export default NavigationMenu;