export const ANALYTICS_EVENTS = {
  // Homepage
  VIEW_HOME: "view_home",
  CLICK_HERO_CTA: "click_hero_cta",

  // Catalog
  VIEW_CATALOG: "view_catalog",
  FILTER_CATALOG: "filter_catalog",
  VIEW_PRODUCT: "view_product",
  ADD_TO_PROJECT: "add_to_project",
  SAVE_TO_WISHLIST: "save_to_wishlist",

  // RFQ
  START_RFQ: "start_rfq",
  SUBMIT_RFQ: "submit_rfq",
  UPLOAD_LOGO: "upload_logo",
  CREATE_MOCKUP_REQUEST: "create_mockup_request",

  // AI Builder
  START_AI_BUILDER: "start_ai_builder",
  COMPLETE_AI_BUILDER: "complete_ai_builder",
  AI_BUILDER_TO_RFQ: "ai_builder_to_rfq",

  // Auth
  LOGIN: "login",
  SIGNUP: "signup",

  // Dashboard
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_ORDERS: "view_orders",
  VIEW_RFQS: "view_rfqs",
  REORDER_CLICK: "reorder_click",

  // Company Store
  COMPANY_STORE_VISIT: "company_store_visit",
  COMPANY_STORE_ORDER: "company_store_order",

  // Checkout
  CHECKOUT_START: "checkout_start",
  PAYMENT_SUCCESS: "payment_success",

  // Engagement
  SCROLL_TO_SECTION: "scroll_to_section",
  CTA_CLICK: "cta_click",
  CONTACT_FORM_SUBMIT: "contact_form_submit",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
