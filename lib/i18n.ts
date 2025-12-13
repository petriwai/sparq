// Multi-language support for Inoka
// Add more languages as needed: fr, zh, ar, etc.

export const translations = {
  en: {
    // Header & Auth
    welcome: "The Real Ones",
    sign_in: "Sign In",
    sign_out: "Sign Out",
    
    // Home Screen
    where_to: "Where to?",
    search_destination: "Search destination...",
    add_place: "Add",
    
    // Ride Request
    choose_ride: "Choose a ride",
    ride_type_standard: "Standard",
    ride_type_premium: "Premium", 
    ride_type_xl: "XL",
    quiet_ride: "Quiet ride",
    pet_friendly: "Pet friendly",
    schedule_later: "Schedule for later",
    confirm_ride: "Confirm Inoka",
    
    // Payment
    payment_required: "Payment Required",
    add_payment_method: "Add Payment Method",
    payment_authorized: "Payment authorized",
    
    // Searching
    finding_driver: "Finding the perfect driver...",
    cancel_request: "Cancel Request",
    
    // Driver Found
    driver_found: "Driver on the way",
    call: "Call",
    message: "Message",
    cancel_ride: "Cancel Ride",
    driver_will_start: "Your driver will start the trip when you're picked up",
    
    // In Ride
    in_ride: "In transit",
    eta: "ETA",
    arrived: "Arrived!",
    
    // Complete
    ride_complete: "Ride Complete!",
    thanks_riding: "Thanks for riding with Inoka",
    ride_fare: "Ride Fare",
    add_tip: "Add a tip for",
    tip_none: "None",
    total: "Total",
    done: "Done",
    
    // Chat
    type_message: "Type a message...",
    send: "Send",
    
    // Saved Places
    save_place: "Save Place",
    label_placeholder: "Label (e.g., Home, Work)",
    
    // Errors
    location_error: "Unable to get your location",
    search_error: "Search failed",
    payment_error: "Payment failed",
    
    // Quick Replies
    quick_here: "I'm here",
    quick_waiting: "Waiting outside",
    quick_thanks: "Thanks!",
    quick_coming: "On my way!",
  },
  
  es: {
    // Header & Auth
    welcome: "Los Verdaderos",
    sign_in: "Iniciar Sesión",
    sign_out: "Cerrar Sesión",
    
    // Home Screen
    where_to: "¿A dónde vas?",
    search_destination: "Buscar destino...",
    add_place: "Añadir",
    
    // Ride Request
    choose_ride: "Elige un viaje",
    ride_type_standard: "Estándar",
    ride_type_premium: "Premium",
    ride_type_xl: "XL",
    quiet_ride: "Viaje silencioso",
    pet_friendly: "Acepta mascotas",
    schedule_later: "Programar para después",
    confirm_ride: "Confirmar Inoka",
    
    // Payment
    payment_required: "Pago Requerido",
    add_payment_method: "Añadir Método de Pago",
    payment_authorized: "Pago autorizado",
    
    // Searching
    finding_driver: "Buscando el conductor perfecto...",
    cancel_request: "Cancelar Solicitud",
    
    // Driver Found
    driver_found: "Conductor en camino",
    call: "Llamar",
    message: "Mensaje",
    cancel_ride: "Cancelar Viaje",
    driver_will_start: "Tu conductor iniciará el viaje cuando te recoja",
    
    // In Ride
    in_ride: "En tránsito",
    eta: "Llegada",
    arrived: "¡Llegamos!",
    
    // Complete
    ride_complete: "¡Viaje Completado!",
    thanks_riding: "Gracias por viajar con Inoka",
    ride_fare: "Tarifa del Viaje",
    add_tip: "Añadir propina para",
    tip_none: "Ninguna",
    total: "Total",
    done: "Listo",
    
    // Chat
    type_message: "Escribe un mensaje...",
    send: "Enviar",
    
    // Saved Places
    save_place: "Guardar Lugar",
    label_placeholder: "Etiqueta (ej., Casa, Trabajo)",
    
    // Errors
    location_error: "No se pudo obtener tu ubicación",
    search_error: "Búsqueda fallida",
    payment_error: "Pago fallido",
    
    // Quick Replies
    quick_here: "Estoy aquí",
    quick_waiting: "Esperando afuera",
    quick_thanks: "¡Gracias!",
    quick_coming: "¡Ya voy!",
  },
  
  fr: {
    // Header & Auth
    welcome: "Les Vrais",
    sign_in: "Connexion",
    sign_out: "Déconnexion",
    
    // Home Screen
    where_to: "Où allez-vous?",
    search_destination: "Rechercher destination...",
    add_place: "Ajouter",
    
    // Ride Request
    choose_ride: "Choisir un trajet",
    ride_type_standard: "Standard",
    ride_type_premium: "Premium",
    ride_type_xl: "XL",
    quiet_ride: "Trajet silencieux",
    pet_friendly: "Animaux acceptés",
    schedule_later: "Programmer pour plus tard",
    confirm_ride: "Confirmer Inoka",
    
    // Payment
    payment_required: "Paiement Requis",
    add_payment_method: "Ajouter un Moyen de Paiement",
    payment_authorized: "Paiement autorisé",
    
    // Searching
    finding_driver: "Recherche du chauffeur parfait...",
    cancel_request: "Annuler la Demande",
    
    // Driver Found
    driver_found: "Chauffeur en route",
    call: "Appeler",
    message: "Message",
    cancel_ride: "Annuler le Trajet",
    driver_will_start: "Votre chauffeur démarrera le trajet à votre montée",
    
    // In Ride
    in_ride: "En cours",
    eta: "Arrivée",
    arrived: "Arrivé!",
    
    // Complete
    ride_complete: "Trajet Terminé!",
    thanks_riding: "Merci d'avoir voyagé avec Inoka",
    ride_fare: "Tarif du Trajet",
    add_tip: "Ajouter un pourboire pour",
    tip_none: "Aucun",
    total: "Total",
    done: "Terminé",
    
    // Chat
    type_message: "Tapez un message...",
    send: "Envoyer",
    
    // Saved Places
    save_place: "Enregistrer le Lieu",
    label_placeholder: "Libellé (ex., Maison, Travail)",
    
    // Errors
    location_error: "Impossible d'obtenir votre position",
    search_error: "Recherche échouée",
    payment_error: "Paiement échoué",
    
    // Quick Replies
    quick_here: "Je suis là",
    quick_waiting: "J'attends dehors",
    quick_thanks: "Merci!",
    quick_coming: "J'arrive!",
  },
}

export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations['en']
