/* =========================================================
   CONFIGURACIÓN ÚNICA DEL SITIO
   Cambia SOLO este archivo para adaptar la invitación.
   Los valores entre [CORCHETES] son placeholders visibles.
   ========================================================= */

window.SITE_CONFIG = {

  meta: {
    lang: "es",
    title: "Boda de [NOMBRE_NOVIA] & [NOMBRE_NOVIO]",
    description: "Acompáñanos a celebrar nuestra boda"
  },

  /* ---------- TEMA (colores y tipografías) ---------- */
  theme: {
    fonts: {
      heading: "'Cormorant Garamond', Georgia, serif",
      body: "'Inter', system-ui, -apple-system, sans-serif"
    },
    colors: {
      paper:      "#f6f1e7",
      paperDeep:  "#e8dfcf",
      card:       "#fffdf8",
      ink:        "#3a3226",
      inkSoft:    "#6b6152",
      accent:     "#8a5a3f",
      accentSoft: "#c9a227"
    }
  },

  /* ---------- HERO / PORTADA (OPCIONAL) ----------
     enabled: false → el sitio arranca en "Mensaje de bienvenida"
     type: "popup-book" (3D) | "none"
  ------------------------------------------------ */
  hero: {
    enabled: true,
    type: "popup-book",
    eyebrow: "[NOMBRE_NOVIA] & [NOMBRE_NOVIO]",
    title: "Abre nuestra invitación",
    subtitle: "[FECHA] · [LUGAR]",
    buttonLabel: "Abrir invitación",
    scene: {
      bookColor:   "#e8dfcf",
      groundColor: "#f6f1e7",
      // Backdrop: lámina grande al fondo del pop-up
      backdrop: { w: 2.0, h: 1.9, color: "#d9cdb8", x: 0.0, z: -0.55 },
      // Standees: figuras recortadas que se levantan
      standees: [
        { w: 0.55, h: 1.30, color: "#9c6b4f", x: -0.55, z:  0.25 }, // arco
        { w: 0.34, h: 0.95, color: "#3a3226", x:  0.10, z:  0.40 }, // figura 1
        { w: 0.34, h: 0.95, color: "#6b6152", x:  0.52, z:  0.40 }, // figura 2
        { w: 0.30, h: 0.55, color: "#c9a227", x:  0.95, z:  0.15 }  // detalle
      ]
    }
  },

  /* ---------- PAREJA / EVENTO ---------- */
  couple: {
    bride: "[NOMBRE_NOVIA]",
    groom: "[NOMBRE_NOVIO]"
  },

  event: {
    // Formato ISO con zona horaria. Si dejas un placeholder,
    // la cuenta regresiva se desactiva y muestra el placeholder.
    dateTimeISO: "[FECHA_ISO]",      // ej. "2026-06-20T17:00:00-05:00"
    dateLabel:   "[FECHA]",          // ej. "Sábado 20 de junio de 2026"
    timeLabel:   "[HORA]",
    place:       "[LUGAR]"
  },

  /* ---------- NAVEGACIÓN ----------
     id  = ancla de la sección en la página
     key = nombre de la sección en "sections" (si está desactivada, no sale en el menú)
  ---------- */
  nav: [
    { id: "bienvenida", key: "welcome", label: "Bienvenida" },
    { id: "fecha",      key: "date", label: "Fecha" },
    { id: "ceremonia",  key: "ceremony", label: "Ceremonia" },
    { id: "cronograma", key: "timeline", label: "Cronograma" },
    { id: "galeria",    key: "gallery", label: "Galería" },
    { id: "rsvp",       key: "rsvp", label: "Confirmar" }
  ],

  /* ---------- SECCIONES ---------- */
  sections: {

    /* 1. Mensaje de bienvenida */
    welcome: {
      enabled: true,
      title: "¡Nos casamos!",
      phrase: "Dos corazones, un nuevo comienzo.",
      names: "[NOMBRE_NOVIA] & [NOMBRE_NOVIO]"
    },

    /* 2. Fecha destacada */
    date: {
      enabled: true,
      title: "Reserva la fecha",
      weekday: "[DÍA_SEMANA]",
      day:     "[DÍA]",
      month:   "[MES]",
      year:    "[AÑO]",
      ctaLabel: "Ver todos los detalles",
      ctaTarget: "#ceremonia"
    },

    /* 3. Save the date — calendario */
    saveTheDate: {
      enabled: true,
      title: "Save the date",
      caption: "Nos vemos el [DÍA]",
      // Año y mes (1-12) para dibujar el calendario.
      // Si son placeholders, se dibuja un mes genérico.
      year: "[AÑO]",
      month: "[MES_NUM]",
      highlightDay: "[DÍA]"
    },

    /* 4. Familias */
    families: {
      enabled: true,
      title: "Con el cariño de nuestras familias",
      groups: [
        { label: "Familia de [NOMBRE_NOVIA]", names: ["[PADRE_NOVIA]", "[MADRE_NOVIA]"] },
        { label: "Familia de [NOMBRE_NOVIO]", names: ["[PADRE_NOVIO]", "[MADRE_NOVIO]"] }
      ]
    },

    /* 5. Cuenta regresiva */
    countdown: {
      enabled: true,
      title: "Cuenta regresiva",
      expiredText: "¡Hoy es el gran día!"
    },

    /* 6. Ceremonia y recepción */
    ceremony: {
      enabled: true,
      title: "Ceremonia y recepción",
      items: [
        {
          kind: "Ceremonia",
          time: "[HORA_CEREMONIA]",
          place: "[LUGAR_CEREMONIA]",
          address: "[DIRECCION_CEREMONIA]",
          mapUrl: "[MAPA_CEREMONIA]"
        },
        {
          kind: "Recepción",
          time: "[HORA_RECEPCION]",
          place: "[LUGAR_RECEPCION]",
          address: "[DIRECCION_RECEPCION]",
          mapUrl: "[MAPA_RECEPCION]"
        }
      ]
    },

    /* 7. Código de vestimenta (opcional) */
    dressCode: {
      enabled: true,
      title: "Código de vestimenta",
      general: "[CODIGO_VESTIMENTA]",
      her: "[RECOMENDACION_ELLAS]",
      him: "[RECOMENDACION_ELLOS]"
    },

    /* 8. Cronograma */
    timeline: {
      enabled: true,
      title: "Cronograma",
      items: [
        { time: "[HORA_1]", label: "Entrada de los novios" },
        { time: "[HORA_2]", label: "Vals" },
        { time: "[HORA_3]", label: "Cena" },
        { time: "[HORA_4]", label: "Corte de la torta" },
        { time: "[HORA_5]", label: "Despedida" }
      ]
    },

    /* 9. Galería */
    gallery: {
      enabled: true,
      title: "Nuestra pequeña galería",
      // "src" real → <img>. Si empieza por "[" → placeholder de papel.
      photos: [
        { src: "[FOTO_1]", alt: "[DESCRIPCION_FOTO_1]" },
        { src: "[FOTO_2]", alt: "[DESCRIPCION_FOTO_2]" },
        { src: "[FOTO_3]", alt: "[DESCRIPCION_FOTO_3]" },
        { src: "[FOTO_4]", alt: "[DESCRIPCION_FOTO_4]" }
      ]
    },

    /* 10. Mesa de regalos (opcional) */
    gifts: {
      enabled: true,
      title: "Mesa de regalos",
      message: "Tu presencia es nuestro mejor regalo.",
      note: "[NOTA_MESA_REGALOS]",
      linkLabel: "[TEXTO_ENLACE_REGALOS]",
      linkUrl: "[ENLACE_MESA_REGALOS]",
      qrImage: "[QR_MESA_REGALOS]"
    },

    /* 11. Streaming (opcional) */
    streaming: {
      enabled: true,
      title: "Acompáñanos por Zoom",
      time: "[HORA_ZOOM]",
      meetingId: "[ID_REUNION]",
      passcode: "[CONTRASENA_ZOOM]",
      url: "[ENLACE_ZOOM]",
      urlLabel: "Unirse a la transmisión"
    },

    /* 12. RSVP */
    rsvp: {
      enabled: true,
      title: "¿Nos acompañas?",
      message: "Confirma tu asistencia antes del [FECHA_LIMITE_RSVP].",
      buttonLabel: "Confirmar asistencia",
      url: "[ENLACE_RSVP]",
      deadline: "[FECHA_LIMITE_RSVP]"
    },

    /* 13. Mensaje de cierre */
    closing: {
      enabled: true,
      message: "Gracias por ser parte de este momento.",
      names: "[NOMBRE_NOVIA] & [NOMBRE_NOVIO]",
      date: "[FECHA]"
    }
  }
};