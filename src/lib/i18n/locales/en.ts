/**
 * English (en) translations for EduCampusHub
 * This is the base/reference language file.
 */

export const translations: Record<string, unknown> = {
  // ===================== NAVBAR =====================
  nav: {
    logo: {
      brandPrefix: 'Edu',
      brandName: 'CampusHub',
    },
    item: {
      home: 'Home',
      explore: 'Explore',
      categories: 'Categories',
      reader: 'Reader',
      dashboard: 'Dashboard',
      sell: 'Sell',
    },
    search: {
      placeholder: 'Search books, notes...',
    },
    profile: {
      myProfile: 'My Profile',
      wishlist: 'Wishlist',
      logout: 'Logout',
    },
    loginButton: 'Login',
    loginButtonMobile: 'Login / Sign Up',
    language: 'Language',
  },

  // ===================== FOOTER =====================
  footer: {
    logo: {
      brandPrefix: 'Edu',
      brandName: 'CampusHub',
    },
    brand: {
      tagline: "Buy • Sell • Exchange — India's trusted student marketplace for books, notes, and study essentials.",
    },
    section: {
      about: 'About',
      categories: 'Categories',
      support: 'Support',
      connect: 'Connect',
    },
    link: {
      browseBooks: 'Browse Books',
      sellYourBooks: 'Sell Your Books',
      wishlist: 'Wishlist',
      login: 'Login',
      medical: 'Medical',
      engineering: 'Engineering',
      neetJee: 'NEET / JEE',
      upscGpsc: 'UPSC / GPSC',
      privacyPolicy: 'Privacy Policy',
      termsConditions: 'Terms & Conditions',
    },
    connect: {
      email: 'support@educampushub.in',
      location: 'Mumbai, India',
    },
    copyright: '© 2025 EduCampusHub. All rights reserved.',
    madeWith: 'Made with',
    inIndia: 'in India',
  },

  // ===================== CATEGORIES SECTION (Home page) =====================
  categoriesSection: {
    heading: {
      prefix: 'Browse by',
      highlight: 'Category',
    },
    subheading: 'Find exactly what you need from textbooks to study kits',
  },

  // ===================== CATEGORY EXPLORER PAGE =====================
  categoryExplorer: {
    badgeText: '14 Categories for Every Student',
    heading: {
      prefix: 'Explore',
      highlight: 'Everything',
      suffix: 'for Students',
    },
    subheading: 'From school books to handwritten notes, competitive exam prep to e-books — find it all on EduCampusHub',
    searchPlaceholder: 'Search books, notes, study kits...',
    searchButton: 'Search',
    featuredCollections: {
      heading: 'Featured Collections',
      backToSchool: { name: 'Back to School', description: 'Everything for new session' },
      examPrepBundle: { name: 'Exam Prep Bundle', description: 'NEET, JEE, UPSC material' },
      collegeStarterKit: { name: 'College Starter Kit', description: 'Essentials for freshers' },
    },
    allCategories: {
      heading: 'All Categories',
    },
    viewAll: 'View All',
    emptyListings: 'No listings in this category yet',
    beFirstToList: 'Be the first to list',
    badge: {
      digital: 'Digital',
      free: 'FREE',
      save: 'Save {savings}%',
    },
  },

  // ===================== EXPLORE PAGE =====================
  explore: {
    heading: {
      explore: 'Explore',
      books: 'Books',
    },
    listingsCount: '{total} listings found',
    searchFallback: 'Search for books, notes, and more',
    searchPlaceholder: 'Search books, notes, courses...',
    filters: 'Filters',
    sort: {
      newest: 'Newest',
      priceLow: 'Price ↑',
      priceHigh: 'Price ↓',
      popular: 'Popular',
    },
    clearAll: 'Clear all',
    filter: {
      category: 'Category',
      allCategories: 'All Categories',
      city: 'City',
      allCities: 'All Cities',
      condition: 'Condition',
      anyCondition: 'Any Condition',
      semester: 'Semester',
      anySemester: 'Any Semester',
    },
    semSuffix: 'Sem',
    noListings: {
      heading: 'No listings found',
      message: 'Try adjusting your search or filters',
    },
    clearFilters: 'Clear Filters',
    badge: {
      featured: 'Featured',
      urgent: 'Urgent',
      verified: 'Verified',
      save: 'Save {savings}%',
    },
    chat: 'Chat',
    loadMore: 'Load More',
  },

  // ===================== SELL PRODUCT PAGE =====================
  sell: {
    back: 'Back',
    heading: {
      prefix: 'Sell on',
      highlight: 'EduCampusHub',
    },
    subheading: 'List your product in under 2 minutes and reach thousands of students across India',
    credits: {
      available: '{n} Upload Credit(s) Available',
      limitReached: 'Upload Limit Reached',
      freePaid: '{free} free · {paid} paid',
      paidOnly: '{n} paid credit(s)',
      buyMore: 'Buy credits to upload more books',
      buyButton: 'Buy ₹10',
      freeUploadsUsed: 'Free uploads used',
    },
    step: {
      details: 'Details',
      photos: 'Photos',
      review: 'Review',
    },
    error: {
      globalTitle: 'Something went wrong',
    },
    label: {
      listingType: 'Listing Type',
      productName: 'Product Name *',
      description: 'Description *',
      originalPrice: 'Original Price',
      sellingPrice: 'Selling Price *',
      category: 'Category *',
      condition: 'Condition *',
      semester: 'Semester',
      standardClass: 'Standard / Class',
      board: 'Board',
      course: 'Course',
      collegeName: 'College Name',
      city: 'City *',
      whatsappNumber: 'WhatsApp Number *',
      productPhotos: 'Product Photos *',
    },
    placeholder: {
      productName: 'e.g., HC Verma Concepts of Physics Vol 1',
      description: 'Describe the product condition, edition, any highlights, cover condition, page quality...',
      originalPrice: 'e.g., 750',
      sellingPrice: 'e.g., 350',
      condition: 'Select condition',
      semester: 'Select semester',
      standardClass: 'Select class',
      board: 'Select board',
      course: 'e.g., Physics, CSE, MBBS, JEE',
      collegeName: 'e.g., IIT Delhi, AIIMS, BITS Pilani',
      city: 'Select city',
      whatsappNumber: '9876543210',
    },
    semesterSuffix: 'Semester',
    classPrefix: 'Class',
    phonePrefix: '+91',
    savingsMessage: 'Students save {savings}%!',
    nextAddPhotos: 'Next: Add Photos',
    photosDescription: 'Add up to {MAX_IMAGES} photos. First photo will be the cover image. Images are automatically compressed for fast loading.',
    dropImagesHere: 'Drop images here',
    clickToUpload: 'Click to upload or drag & drop',
    photoFormatInfo: 'JPG, PNG, WEBP up to 5MB each',
    photosCount: '{count}/{max} photos',
    autoCompressed: 'Auto-compressed',
    uploadedPhotos: 'Uploaded Photos ({count}/{max})',
    cover: 'Cover',
    uploading: 'Uploading...',
    addMore: 'Add More',
    uploadingImages: 'Uploading images...',
    nextReviewPost: 'Next: Review & Post',
    reviewHeading: 'Review Your Listing',
    review: {
      product: 'Product',
      untitled: 'Untitled',
      category: 'Category',
      sellingPrice: 'Selling Price',
      originalPrice: 'Original Price',
      condition: 'Condition',
      city: 'City',
      course: 'Course',
      semester: 'Semester',
      college: 'College',
      whatsapp: 'WhatsApp',
      listingType: 'Listing Type',
      description: 'Description',
      savingsDeal: 'Students save {savings}% on this deal!',
    },
    publishingListing: 'Publishing Listing...',
    uploadingImagesStatus: 'Uploading Images...',
    postListing: 'Post Listing',
    termsAgreement: "By posting, you agree to EduCampusHub's Terms of Service and that your listing is authentic.",
    livePreview: 'Live Preview',
    morePhotos: '+{n} more',
    badge: {
      exchange: 'Exchange',
      free: 'FREE',
    },
    productTitlePlaceholder: 'Product Title',
    verified: 'Verified',
    quickTips: {
      heading: 'Quick Tips',
      tip1: 'Clear photos sell 3x faster',
      tip2: 'Competitive pricing attracts buyers',
      tip3: 'Be honest about product condition',
      tip4: 'Mention edition/year in description',
    },
    photoTips: {
      heading: 'Photo Tips',
      tip1: 'Use good lighting and clean background',
      tip2: 'Show the product from multiple angles',
      tip3: 'Include close-ups of any wear or damage',
      tip4: 'First photo becomes the cover image',
    },
    // Success screen
    success: {
      heading: 'Listing Created!',
      message: 'Your product is now live on EduCampusHub. Students across India can find and contact you on WhatsApp.',
      whatNext: 'What happens next?',
      review24h: 'Your listing will be reviewed within 24 hours',
      verifiedVisibility: 'Verified sellers get more visibility',
      shareWhatsApp: 'Share your listing on WhatsApp for faster sales',
      viewListing: 'View Listing',
      listAnother: 'List Another',
    },
    // Auth required
    authRequired: {
      heading: 'Login to Sell',
      message: 'You need to be logged in to list your products',
      loginButton: 'Login Now',
    },
    // Validation errors
    validation: {
      titleRequired: 'Product name is required',
      titleMinLength: 'Name must be at least 5 characters',
      descriptionRequired: 'Description is required',
      descriptionMinLength: 'Description must be at least 10 characters',
      sellingPriceRequired: 'Valid selling price is required',
      priceMax: 'Price cannot exceed 1,00,000',
      sellingPriceExceedsOriginal: 'Selling price cannot exceed original price',
      categoryRequired: 'Category is required',
      conditionRequired: 'Condition is required',
      cityRequired: 'City is required',
      whatsappRequired: 'WhatsApp number is required',
      whatsappInvalid: 'Enter valid 10-digit Indian mobile number',
      imageRequired: 'At least one image is required',
    },
    // Toast messages
    toast: {
      maxImages: 'Maximum {n} images allowed',
      unsupportedFormat: 'File not supported. Use JPG, PNG, or WEBP.',
      exceedsSize: 'File exceeds 5MB limit.',
      processFailed: 'Failed to process image.',
      imagesAdded: '{n} image(s) added',
      pleaseWait: 'Please wait before submitting again',
      pleaseLogin: 'Please login to create a listing',
      fixErrors: 'Please fix the errors below',
      uploadingImages: 'Uploading images...',
      imagesUploaded: 'Images uploaded!',
      uploadFailed: 'Image upload to server failed. Saving with local previews.',
      creatingListing: 'Creating your listing...',
      uploadLimitReached: 'Upload limit reached. Please buy more credits.',
      listingCreated: 'Listing created successfully!',
      wentWrong: 'Something went wrong. Please try again.',
      fillRequired: 'Please fill all required fields',
      addPhoto: 'Please add at least one photo',
    },
  },

  // ===================== PRODUCT DETAIL PAGE =====================
  product: {
    notFound: {
      heading: 'Listing not found',
      browseButton: 'Browse Listings',
    },
    backToListings: 'Back to listings',
    badge: {
      featured: 'Featured',
      urgentSale: 'Urgent Sale',
      verified: 'Verified',
      save: 'Save {savings}%',
      digital: 'Digital',
    },
    semesterSuffix: 'Semester',
    viewsLabel: 'views',
    description: {
      heading: 'Description',
    },
    college: {
      heading: 'College',
    },
    sellerInfo: {
      heading: 'Seller Information',
      sales: '{totalSales} sales',
    },
    readNow: 'Read Now',
    giveawayMessage: 'This item is being given away for free!',
    exchangeMessage: 'This item is available for exchange',
    whatsapp: 'WhatsApp',
    trustSafety: {
      heading: 'Trust & Safety',
      message: 'Always meet in a public place. Check the book before paying. EduCampusHub never asks for payment directly.',
    },
    reportSubmitted: 'Report submitted. We\'ll review it shortly.',
    reportButton: 'Report this listing',
    reportDialog: {
      title: 'Report Listing',
      placeholder: 'Why are you reporting this listing? (e.g., inappropriate content, scam, wrong information)',
      submit: 'Submit Report',
      loginRequired: 'Please login to report a listing',
    },
    time: {
      today: 'Today',
      yesterday: 'Yesterday',
      daysAgo: '{days} days ago',
      weeksAgo: '{weeks} weeks ago',
      monthsAgo: '{months} months ago',
    },
  },

  // ===================== PROFILE PAGE =====================
  profile: {
    authRequired: {
      heading: 'Please login',
      loginButton: 'Login',
    },
    back: 'Back',
    badge: {
      admin: 'Admin',
      sold: 'Sold',
    },
    sales: '{totalSales} sales',
    editProfile: 'Edit Profile',
    cancel: 'Cancel',
    label: {
      name: 'Name',
      college: 'College',
      city: 'City',
      phone: 'Phone',
      whatsappNumber: 'WhatsApp Number',
    },
    placeholder: {
      selectCity: 'Select city',
    },
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    stats: {
      listings: 'Listings',
      sales: 'Sales',
      rating: 'Rating',
    },
    tabs: {
      myListings: 'My Listings',
      wishlist: 'Wishlist',
      payments: 'Payments',
    },
    noListings: {
      heading: 'No listings yet',
      message: 'Start selling your books!',
      button: 'Sell Now',
    },
    wishlistEmpty: {
      heading: 'Your wishlist is empty',
      message: 'Save books you\'re interested in',
      button: 'Browse Books',
    },
    noPayments: {
      heading: 'No Payments Yet',
      message: 'Your payment history will appear here',
    },
    paymentStatus: {
      verified: 'Verified',
      pending: 'Pending',
      rejected: 'Rejected',
      expired: 'Expired',
    },
    paymentCreditLabel: 'Upload Credit - {amount}',
  },

  // ===================== WISHLIST PAGE =====================
  wishlist: {
    heading: {
      prefix: 'My',
      highlight: 'Wishlist',
    },
    savedCount: '{count} saved items',
    empty: {
      heading: 'Your wishlist is empty',
      message: 'Start saving books you\'re interested in by clicking the heart icon on any listing',
      button: 'Browse Books',
    },
    badge: {
      save: 'Save {savings}%',
    },
  },

  // ===================== SAVED MATERIALS PAGE =====================
  saved: {
    heading: {
      prefix: 'My',
      highlight: 'Collection',
    },
    itemCount: '{count} items in your collection',
    tab: {
      saved: 'Saved',
      wishlist: 'Wishlist',
      bookmarks: 'Bookmarks',
    },
    empty: {
      saved: {
        title: 'No Saved Materials',
        desc: 'Save books and notes to access them quickly',
      },
      wishlist: {
        title: 'Wishlist is Empty',
        desc: 'Add items you want to buy to your wishlist',
      },
      bookmarks: {
        title: 'No Bookmarks',
        desc: 'Bookmark reading materials to continue later',
      },
    },
    exploreListings: 'Explore Listings',
    badge: {
      digital: 'Digital',
      free: 'FREE',
      save: 'Save {savings}%',
    },
  },

  // ===================== LEARNING DASHBOARD =====================
  dashboard: {
    heading: {
      prefix: 'Learning',
      highlight: 'Dashboard',
    },
    welcomeBack: 'Welcome back, {name}!',
    trackJourney: 'Track your learning journey',
    stats: {
      booksReading: 'Books Reading',
      active: 'Active',
      savedMaterials: 'Saved Materials',
      bookmarks: 'Bookmarks',
      saved: 'Saved',
      recentlyViewed: 'Recently Viewed',
      items: 'Items',
    },
    quickActions: {
      heading: 'Quick Actions',
      browseNotes: 'Browse Notes',
      readEbooks: 'Read E-books',
      handwrittenNotes: 'Handwritten Notes',
      sellOldBooks: 'Sell Old Books',
    },
    studyProgress: {
      heading: 'Study Progress',
      thisWeek: 'This Week',
      keepExploring: 'Keep exploring',
    },
    continueReading: {
      heading: 'Continue Reading',
    },
    studyMaterial: 'Study Material #{id}',
    pageLabel: 'Page {page}',
    noReadingProgress: 'No reading in progress',
    browseEbooks: 'Browse E-books',
    savedMaterials: {
      heading: 'Saved Materials',
    },
    viewAll: 'View All',
    savedItem: 'Saved Item #{id}',
    tapToView: 'Tap to view details',
    noSavedMaterials: 'No saved materials yet',
    exploreAndSave: 'Explore & Save',
    recommended: {
      heading: 'Recommended for You',
    },
    seeAll: 'See All',
    trending: {
      heading: 'Trending Now',
    },
    badge: {
      digital: 'Digital',
      free: 'FREE',
    },
    viewsLabel: 'views',
  },

  // ===================== FEATURED LISTINGS =====================
  featured: {
    heading: {
      prefix: 'Featured',
      highlight: 'Listings',
    },
    subheading: 'Handpicked deals from verified sellers across India',
    badge: {
      featured: 'Featured',
      urgent: 'Urgent',
      verified: 'Verified',
      save: 'Save {savings}%',
    },
    chat: 'Chat',
  },

  // ===================== WHY CHOOSE SECTION =====================
  whyChoose: {
    heading: {
      prefix: 'Why Students',
      highlight: 'Love EduCampusHub',
    },
    subheading: 'Built by students, for students. Every feature designed to make your life easier.',
    feature: {
      noMiddleman: {
        title: 'No Middleman',
        desc: 'Connect directly with students. No commissions, no hidden fees, no markup.',
      },
      save70: {
        title: 'Save 70%+',
        desc: 'Save up to 70% on textbooks. Why buy new when you can get the same knowledge for less?',
      },
      directContact: {
        title: 'Direct Contact',
        desc: 'Chat with sellers directly on WhatsApp. Instant communication, zero delay.',
      },
      trustedCommunity: {
        title: 'Trusted Community',
        desc: 'Verified students from real colleges. Every listing is from a genuine student.',
      },
      easySelling: {
        title: 'Easy Selling',
        desc: "List your books in under 2 minutes. Just fill in the details and you're live!",
      },
      smartSearch: {
        title: 'Smart Search',
        desc: 'Find exactly what you need by category, college, course, or city. Smart filters.',
      },
    },
  },

  // ===================== ADMIN DASHBOARD =====================
  admin: {
    accessDenied: {
      heading: 'Access Denied',
      message: 'You need admin privileges to access this page',
      goHome: 'Go Home',
    },
    back: 'Back',
    refresh: 'Refresh',
    heading: {
      prefix: 'Admin',
      highlight: 'Dashboard',
    },
    subheading: 'Manage listings, users, and reports',
    stats: {
      totalUsers: 'Total Users',
      totalListings: 'Total Listings',
      activeReports: 'Active Reports',
      totalViews: 'Total Views',
    },
    chart: {
      listingsByCity: 'Listings by City',
      listingsByCategory: 'Listings by Category',
    },
    tabs: {
      reports: 'Reports',
      users: 'Users',
      recent: 'Recent',
    },
    noReports: 'No reports found',
    report: {
      resolved: 'Resolved',
      open: 'Open',
      reportedBy: 'Reported by {name} ({email})',
    },
    markResolved: 'Mark Resolved',
    badge: {
      admin: 'Admin',
      banned: 'Banned',
    },
    noCollege: 'No college',
    listingsCount: '{count} listings',
    unban: 'Unban',
    ban: 'Ban',
    by: 'by',
    verify: 'Verify',
    delete: 'Delete',
    confirmDelete: 'Delete this listing?',
  },

  // ===================== PAYMENT MODAL =====================
  payment: {
    header: {
      title: 'Upload Credit',
      subtitle: '1 Book Upload for ₹10',
    },
    timer: {
      remaining: 'Time remaining: {time}',
      hurry: 'Hurry!',
    },
    creatingSession: 'Creating payment session...',
    scanQR: 'Scan with any UPI app (GPay, PhonePe, Paytm, etc.)',
    orPayToUpi: 'Or pay to UPI ID:',
    copy: 'Copy',
    copied: 'Copied!',
    amountToPay: 'Amount to Pay',
    iveMadePayment: "I've Made the Payment",
    afterPayClick: 'After paying, click above to submit your payment proof',
    proofRequired: {
      title: 'Payment Proof Required',
      description: 'Enter the UTR/Reference number from your UPI payment. This is a 12-digit number found in your payment receipt.',
    },
    utrLabel: 'UTR / Reference Number',
    utrPlaceholder: 'Enter 12-digit UTR number',
    utrHint: 'Find this in your UPI app payment receipt',
    screenshotLabel: 'Payment Screenshot (Optional)',
    clickToUpload: 'Click to upload screenshot',
    screenshotFormat: 'JPG, PNG, WEBP (max 5MB)',
    screenshotHint: 'Upload a screenshot of your completed payment for faster verification',
    backToQR: 'Back to QR',
    submitProof: 'Submit Proof',
    submittingProof: 'Submitting Proof',
    submittingMessage: 'Please wait while we submit your payment proof...',
    proofSubmitted: 'Proof Submitted!',
    successMessage: 'Payment proof submitted! Admin will verify within 24 hours. You\'ll be notified once verified.',
    pendingVerification: 'Pending Verification',
    continueToUpload: 'Continue to Upload',
    sessionExpired: 'Session Expired',
    expiredMessage: 'Your payment session has expired after 5 minutes. Please try again.',
    tryAgain: 'Try Again',
    somethingWentWrong: 'Something Went Wrong',
    unexpectedError: 'An unexpected error occurred.',
    close: 'Close',
    securePayment: 'Secure payment powered by UPI',
    error: {
      network: 'Network error. Please try again.',
      createSession: 'Failed to create payment session',
      verificationFailed: 'Payment verification failed',
      uploadImage: 'Please upload an image file',
      screenshotSize: 'Screenshot must be less than 5MB',
      utrOrScreenshot: 'Please enter your UTR/Reference number or upload a screenshot',
      utrMinLength: 'UTR number must be at least 6 digits',
    },
    alt: {
      qrCode: 'UPI QR Code',
      screenshot: 'Payment screenshot',
    },
  },

  // ===================== LOGIN PAGE =====================
  login: {
    brand: {
      welcome: 'Welcome to EduCampusHub',
      tagline: 'Buy • Sell • Exchange — India\'s trusted student marketplace.',
      '0percent': '0%',
      commission: 'Commission',
      direct: 'Direct',
      studentToStudent: 'Student to Student',
      '100percent': '100%',
      safeVerified: 'Safe & Verified',
    },
    mobileBrand: {
      tagline: 'Buy • Sell • Exchange',
    },
    heading: {
      prefix: 'Welcome to',
      highlight: 'EduCampusHub',
    },
    subheading: 'Login with your college email to start buying and selling',
    tabs: {
      login: 'Login',
      register: 'Register',
    },
    label: {
      collegeEmail: 'College Email',
      name: 'Full Name',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      phone: 'Phone (Optional)',
    },
    placeholder: {
      email: 'you@college.ac.in',
      name: 'Enter your full name',
      password: 'Enter your password',
      confirmPassword: 'Confirm your password',
      phone: '+91 XXXXX XXXXX',
    },
    button: {
      login: 'Login',
      register: 'Create Account',
      loggingIn: 'Logging in...',
      registering: 'Creating Account...',
    },
    continueButton: 'Continue',
    loggingIn: 'Logging in...',
    or: 'or',
    continueWithGoogle: 'Continue with Google',
    error: {
      loginFailed: 'Login failed',
      wentWrong: 'Something went wrong. Please try again.',
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required',
      nameRequired: 'Name is required',
      invalidEmail: 'Please enter a valid email',
      passwordTooShort: 'Password must be at least 8 characters',
      passwordWeak: 'Password must include uppercase, lowercase, number, and special character',
      passwordMismatch: 'Passwords do not match',
      emailExists: 'An account with this email already exists',
      invalidCredentials: 'Invalid email or password',
      accountBanned: 'This account has been banned',
    },
    success: {
      registered: 'Account created successfully!',
    },
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    forgotPassword: 'Forgot password?',
    otp: {
      verifyIdentity: 'Verify Your Identity',
      verifyEmail: 'Verify Your Email',
      sentTo: 'We sent a verification code to your email',
      enterCode: 'Enter the 6-digit code sent to your email',
      resendIn: 'Resend OTP in',
      resend: 'Resend OTP',
      sending: 'Sending OTP...',
      verifying: 'Verifying...',
      verify: 'Verify OTP',
      back: 'Back',
      expired: 'OTP has expired. Please request a new one.',
      invalid: 'Invalid OTP code.',
      tooManyAttempts: 'Too many failed attempts. Please request a new OTP.',
      rateLimited: 'Please wait before requesting a new OTP.',
      emailSent: 'OTP sent to your email',
      andSmsTo: 'and SMS to',
      resetPassword: 'Reset Password',
      resetSuccess: 'Password Reset Successful!',
      redirecting: 'Redirecting to login...',
    },
  },

  // ===================== FORGOT PASSWORD =====================
  forgotPassword: {
    title: 'Reset Password',
    subtitle: 'Enter your registered mobile number to receive a verification code',
    verifyTitle: 'Verify OTP',
    verifySubtitle: 'Enter the 6-digit code sent to {phone}',
    resetTitle: 'Create New Password',
    resetSubtitle: 'Your identity is verified. Set a new secure password.',
    successTitle: 'Password Updated!',
    successSubtitle: 'Your password has been successfully reset.',
    successMessage: 'Password updated successfully. Please log in with your new password.',
    backToLogin: 'Back to login',
    step1: 'Phone',
    step2: 'Verify',
    step3: 'Reset',
    label: {
      phone: 'Registered Mobile Number',
      otp: 'Enter 6-digit OTP',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
    },
    placeholder: {
      phone: '+91 98765 43210',
      newPassword: 'Enter new password',
      confirmPassword: 'Confirm new password',
    },
    phoneHint: 'Enter the 10-digit mobile number linked to your EduCampusHub account.',
    otpHint: 'A 6-digit code has been sent via SMS to your registered number.',
    passwordStrength: 'Must include: 8+ characters, uppercase, lowercase, number, and special character',
    resendIn: 'Resend OTP in {seconds}s',
    resendOtp: 'Resend OTP',
    button: {
      sendOtp: 'Send OTP',
      sending: 'Sending OTP...',
      verifyOtp: 'Verify OTP',
      verifying: 'Verifying...',
      resetPassword: 'Reset Password',
      resetting: 'Resetting...',
      goToLogin: 'Go to Login',
    },
    error: {
      phoneRequired: 'Mobile number is required',
      phoneInvalid: 'Please enter a valid 10-digit Indian mobile number',
      otpRequired: 'OTP is required',
      otpInvalid: 'Invalid OTP. Please check and try again.',
      passwordRequired: 'New password is required',
      sendFailed: 'Failed to send OTP. Please try again.',
      resetFailed: 'Failed to reset password. Please try again.',
      wentWrong: 'Something went wrong. Please try again.',
    },
  },

  // ===================== MOBILE NAV (page.tsx) =====================
  mobileNav: {
    home: 'Home',
    categories: 'Categories',
    sell: 'Sell',
    reader: 'Reader',
    dashboard: 'Dashboard',
  },

  // ===================== META / SEO =====================
  meta: {
    title: 'EduCampusHub — Buy • Sell • Exchange',
    titleTemplate: '%s | EduCampusHub',
    description: "Buy • Sell • Exchange — India's trusted student marketplace for books, notes, and study essentials. Save up to 70% on textbooks for NEET, JEE, UPSC, and more.",
    ogTitle: 'EduCampusHub — Buy • Sell • Exchange',
    ogDescription: 'Buy & sell old books directly with students. Save up to 70% on textbooks for NEET, JEE, UPSC & more.',
    ogImageAlt: 'EduCampusHub - Student Marketplace',
  },

  // ===================== CATEGORIES (from store.ts) =====================
  categories: {
    schoolBooks: { name: 'School Books', description: 'Std 1–12 textbooks' },
    cbse: { name: 'CBSE Books', description: 'CBSE board textbooks' },
    gseb: { name: 'GSEB Books', description: 'Gujarat Board textbooks' },
    icse: { name: 'ICSE Books', description: 'ICSE board textbooks' },
    collegeBooks: { name: 'College Books', description: 'All semester textbooks' },
    medical: { name: 'Medical Books', description: 'MBBS, BDS, Pharmacy' },
    engineering: { name: 'Engineering Books', description: 'All branches' },
    commerceLaw: { name: 'Commerce & Law', description: 'BCom, CA, LLB' },
    competitive: { name: 'UPSC / NEET / JEE', description: 'Competitive exam prep' },
    notesPdfs: { name: 'Notes & PDFs', description: 'Study notes & guides' },
    handwritten: { name: 'Handwritten Notes', description: 'Topper notes' },
    ebooks: { name: 'E-books', description: 'Digital books' },
    notebooks: { name: 'Used Notebooks', description: 'Bind, ruled, plain' },
    studyKits: { name: 'Study Kits', description: 'Bundled essentials' },
  },

  // ===================== CONDITIONS =====================
  conditions: {
    likeNew: 'Like New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  },

  // ===================== BOARDS =====================
  boards: {
    cbse: 'CBSE',
    gseb: 'GSEB',
    icse: 'ICSE',
    isc: 'ISC',
    stateBoard: 'State Board',
    other: 'Other',
  },

  // ===================== LISTING TYPES =====================
  listingTypes: {
    sell: 'Sell',
    exchange: 'Exchange',
    giveaway: 'Give Away',
  },

  // ===================== COMMON SHARED STRINGS =====================
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    search: 'Search',
    noResults: 'No results found',
    login: 'Login',
    logout: 'Logout',
    verified: 'Verified',
    free: 'FREE',
    digital: 'Digital',
    sold: 'Sold',
    featured: 'Featured',
    savePercent: 'Save {savings}%',
    classPrefix: 'Class',
    semesterPrefix: 'Semester',
  },

  // ===================== HERO SECTION =====================
  hero: {
    heading: {
      line1: 'Buy & Sell Old Books',
      line2: 'Directly With Students',
    },
    description: "India's most trusted student marketplace for books, notes, and study essentials. Save up to 70% on textbooks with zero middleman.",
    startSelling: 'Start Selling',
    exploreBooks: 'Explore Books',
    followInstagram: 'Follow @educampushubofficial for deals & study tips',
  },

  // ===================== APP DOWNLOAD SECTION =====================
  appDownload: {
    comingSoon: 'Coming Soon on Play Store',
    heading: 'Get EduCampusHub on Your Phone',
    description: 'Browse, buy and sell on the go. Get notified instantly when someone lists a book you need. Be the first to grab the best deals!',
    onTheList: "You're on the list! We'll notify you.",
    enterEmail: 'Enter your email',
    notifyMe: 'Notify Me',
  },
}
