import { Link, useLocation } from "react-router-dom";
import { Ic }   from "./icons";
import { cls }  from "./ui/primitives";

const NAV_ITEMS = [
  { id: "pipeline",  label: "Pipeline",   I: Ic.Layers, to: "/prospects"  },
  // { id: "followups", label: "Follow-ups", I: Ic.Bell,   to: "/followups"  },
  { id: "bill-dues", label: "Bill Dues", I: Ic.Bell,   to: "/bill-dues"  },
  { id: "products",  label: "Products",   I: Ic.Box,    to: "/products"   },
  { id: "dashboard", label: "Dashboard",  I: Ic.Home,   to: "/dashboard"  },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-inset-bottom">
      {NAV_ITEMS.map(item => {
        const I      = item.I;
        const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cls(
              "relative flex flex-1 flex-col items-center justify-center py-3 gap-0.5 transition-colors duration-200",
              active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-indigo-600" />
            )}
            <I
              className={cls(
                "h-5 w-5 transition-transform duration-200",
                active ? "text-indigo-600 scale-110" : ""
              )}
            />
            <span
              className={cls(
                "text-[10px] font-medium transition-colors duration-200",
                active ? "text-indigo-600" : "text-slate-400"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
