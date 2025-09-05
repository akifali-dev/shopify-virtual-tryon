// import React from "react";
// import ReactDOM from "react-dom/client";
// import "./index.css";
// import { VirtualFittingRoom } from "./extension-code/virtual-fitting-room";

// const rootEl = document.getElementById("tryon-root");
// const appEl = document.getElementById("tryon-app");

// if (rootEl && appEl) {
//   const { productId, productName, productImage, garmentType, widgetClasses } =
//     rootEl.dataset;

//   ReactDOM.createRoot(appEl).render(
//     <VirtualFittingRoom
//       garmentId={productId}
//       garmentImage={productImage}
//       garmentName={productName}
//       garmentType={garmentType || "tops"}
//       widgetClasses={widgetClasses || ""}
//       onClose={() => {}}
//     />,
//   );
// }

// ========================================================================

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { TryOnModal } from "./new-code/components/TryOnModal";

const rootEl = document.getElementById("tryon-root");
const appEl = document.getElementById("tryon-app");

if (rootEl && appEl) {
  const { productId, productName, productImage, garmentType, widgetClasses } =
    rootEl.dataset;

  ReactDOM.createRoot(appEl).render(
    <TryOnModal
      garmentId={productId}
      garmentImage={productImage}
      garmentName={productName}
      garmentType={garmentType || "top"}
      widgetClasses={widgetClasses || ""}
      onClose={() => {}}
    />,
  );
}
