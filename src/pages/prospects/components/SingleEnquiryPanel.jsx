import { Backdrop, Sheet, SheetHead } from "../ui/primitives";
import EnquiryCard from "./EnquiryCard";

export default function SingleEnquiryPanel({ item, rfq, autoExpandSQ = false, token, user, onClose, onUpdated }) {
  return (
    <Backdrop>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <SheetHead
          title={item.company_name}
          subtitle={rfq.product_name || rfq.product_category || "Enquiry"}
          onClose={onClose}
          accent="bg-gradient-to-r from-white to-indigo-50/30"
        />
        <div className="p-5">
          <EnquiryCard
            rfq={{ ...rfq, _leadItem: item }}
            token={token} user={user} canEdit={true}
            order={null}
            onUpdated={onUpdated}
            defaultExpanded={autoExpandSQ}
            autoExpandSQ={autoExpandSQ}
          />
        </div>
      </Sheet>
    </Backdrop>
  );
}