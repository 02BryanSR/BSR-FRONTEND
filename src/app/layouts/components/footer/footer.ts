import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';

type FooterPanelId = 'contact' | 'about' | 'privacy' | 'terms' | 'cookies';

type FooterLink = {
  readonly title: string;
  readonly panelId: FooterPanelId;
  readonly label: string;
};

type FooterPanel = {
  readonly id: FooterPanelId;
  readonly kicker: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
};

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.html',
})
export class Footer {
  @ViewChild('footerSection') private footerSection?: ElementRef<HTMLElement>;
  @ViewChild('panelContent') private panelContent?: ElementRef<HTMLElement>;

  readonly activePanel = signal<FooterPanelId | null>(null);

  readonly links: readonly FooterLink[] = [
    {
      title: 'Ayuda',
      panelId: 'contact',
      label: 'Contacto',
    },
    {
      title: 'Empresa',
      panelId: 'about',
      label: 'Quienes somos',
    },
    {
      title: 'Politicas',
      panelId: 'privacy',
      label: 'Politica de privacidad',
    },
    {
      title: 'Legal',
      panelId: 'terms',
      label: 'Terminos y condiciones',
    },
    {
      title: 'Cookies',
      panelId: 'cookies',
      label: 'Politica de cookies',
    },
  ];

  readonly panels: readonly FooterPanel[] = [
    {
      id: 'contact',
      kicker: 'Atencion al cliente',
      title: 'Contacto',
      paragraphs: [
        'En Bold Style Revolution cuidamos cada detalle, tambien en la atencion al cliente.',
        'Si necesitas asistencia personalizada, estaremos encantados de ayudarte.',
        'Correo: bolc021299@gmail.com',
        'Telefono: +34 687 07 77 44',
        'Horario: de lunes a viernes.',
      ],
    },
    {
      id: 'about',
      kicker: 'Empresa',
      title: 'Quienes somos',
      paragraphs: [
        'BSR nace con la vision de redefinir la forma en que se experimenta la moda elegante en el entorno digital.',
        'Nos especializamos en prendas y accesorios pensados para destacar en eventos, con una linea visual contemporanea y sofisticada.',
        'Nuestra filosofia se apoya en la simplicidad, la calidad y una identidad clara en cada detalle.',
      ],
    },
    {
      id: 'privacy',
      kicker: 'Politicas',
      title: 'Politica de privacidad',
      paragraphs: [
        'En BSR recopilamos unicamente los datos necesarios para gestionar tu cuenta, procesar pedidos y mejorar tu experiencia de compra.',
        'Tu informacion se utiliza de forma segura y no se comparte con terceros, salvo cuando es necesario para envio, pago o soporte.',
        'Aplicamos medidas de seguridad para proteger tus datos y mantener su confidencialidad.',
      ],
    },
    {
      id: 'terms',
      kicker: 'Politicas',
      title: 'Terminos y condiciones',
      paragraphs: [
        'El uso de esta plataforma implica la aceptacion de los presentes terminos y condiciones.',
        'BSR ofrece productos sujetos a disponibilidad y se reserva el derecho de modificar precios, contenidos o servicios en cualquier momento.',
        'El usuario se compromete a proporcionar informacion veraz y a hacer un uso adecuado de la plataforma.',
        'BSR no se responsabiliza de un uso indebido del servicio ni de interrupciones ajenas a su control.',
      ],
    },
    {
      id: 'cookies',
      kicker: 'Politicas',
      title: 'Politica de cookies',
      paragraphs: [
        'Este sitio utiliza cookies para mejorar la experiencia de navegacion y el funcionamiento de la plataforma.',
        'Las cookies permiten recordar preferencias, gestionar sesiones y analizar el uso del sitio.',
        'Puedes configurar o desactivar las cookies desde tu navegador en cualquier momento.',
      ],
    },
  ];

  readonly activePanelContent = computed(
    () => this.panels.find((panel) => panel.id === this.activePanel()) ?? null,
  );

  togglePanel(panelId: FooterPanelId): void {
    const nextPanelId = this.activePanel() === panelId ? null : panelId;
    this.activePanel.set(nextPanelId);

    if (!nextPanelId) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const footerElement = this.footerSection?.nativeElement;
        const panelElement = this.panelContent?.nativeElement;

        if (!footerElement || !panelElement) {
          return;
        }

        const footerTop = footerElement.getBoundingClientRect().top + window.scrollY;
        const panelHeight = panelElement.getBoundingClientRect().height;
        const viewportHeight = window.innerHeight;
        const topSpacing = 24;
        const visibleRoomBelowHeader = viewportHeight - topSpacing;
        const panelNeedsExtraOffset = panelHeight > visibleRoomBelowHeader * 0.55 ? 0 : 36;
        const targetTop = Math.max(footerTop - topSpacing - panelNeedsExtraOffset, 0);

        window.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });
      });
    });
  }
}
