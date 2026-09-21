import React from 'react';

export interface LogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon' | 'image';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light';
  className?: string;
  subtitle?: string;
}

/**
 * Caminhos vetoriais da Logo Oficial Topa Tudo (Fidelidade cirúrgica)
 * Telhado arquitetônico com chaminé, triângulo áureo e swoosh dinâmico
 */
export const TOPA_TUDO_EMBLEM_YELLOW_PATH = "M 348.5 272.8 L 346.5 269.8 L 339.5 263.0 L 336.8 261.5 L 334.5 259.5 L 332.8 258.8 L 325.0 251.5 L 320.2 249.0 L 315.8 245.0 L 312.8 243.0 L 308.2 238.5 L 306.5 236.0 L 300.8 233.0 L 297.2 229.8 L 294.8 228.0 L 292.2 225.2 L 289.0 223.8 L 287.8 222.5 L 287.0 221.0 L 280.8 217.8 L 279.5 217.5 L 276.8 217.8 L 272.2 219.2 L 269.8 220.8 L 266.8 223.8 L 263.2 226.8 L 259.0 229.8 L 255.5 233.0 L 252.8 234.2 L 250.0 236.2 L 247.2 239.5 L 245.8 240.2 L 243.5 242.8 L 236.5 247.2 L 234.0 249.8 L 229.8 253.0 L 225.2 257.5 L 223.2 259.0 L 220.0 260.5 L 215.0 265.8 L 211.2 268.2 L 208.2 271.5 L 205.0 273.0 L 201.8 276.2 L 199.8 277.5 L 196.0 281.0 L 192.0 283.5 L 188.0 287.2 L 186.0 288.2 L 183.5 290.8 L 182.8 291.0 L 179.2 294.0 L 171.8 299.2 L 167.8 304.0 L 167.0 305.5 L 166.8 308.0 L 167.2 308.8 L 169.2 309.8 L 172.8 310.8 L 175.0 310.8 L 177.2 310.0 L 180.2 310.0 L 186.8 309.0 L 198.0 308.2 L 203.5 307.2 L 207.0 307.2 L 208.2 306.8 L 212.0 306.5 L 218.5 304.8 L 230.2 303.2 L 236.8 301.5 L 242.5 300.8 L 245.0 300.8 L 255.0 298.5 L 258.8 298.2 L 262.8 297.5 L 265.8 296.5 L 269.5 296.0 L 269.8 296.2 L 272.2 295.5 L 277.0 295.0 L 283.2 293.2 L 292.0 292.2 L 295.2 291.2 L 297.8 291.0 L 305.5 288.8 L 309.5 288.2 L 314.2 286.5 L 317.5 286.0 L 320.5 285.0 L 324.0 284.8 L 326.0 284.2 L 332.0 281.8 L 335.2 281.2 L 336.5 280.5 L 343.5 279.2 L 345.5 278.2 L 348.0 276.2 L 348.8 274.5 Z";
export const TOPA_TUDO_EMBLEM_DARK_PATH = "M 635.8 387.0 L 635.8 333.0 L 631.5 329.0 L 626.5 326.2 L 625.0 324.8 L 622.0 323.0 L 619.2 320.2 L 617.5 319.0 L 617.0 318.0 L 614.0 315.0 L 611.5 311.8 L 608.2 305.8 L 608.0 304.2 L 606.5 301.2 L 605.8 298.0 L 605.8 296.5 L 605.2 295.5 L 604.8 290.8 L 604.8 283.0 L 605.0 282.8 L 605.0 280.2 L 605.5 277.2 L 605.5 272.5 L 605.8 272.2 L 605.8 256.2 L 605.5 256.0 L 605.2 250.8 L 604.8 249.2 L 605.0 246.5 L 603.5 241.0 L 603.5 238.5 L 602.2 235.2 L 602.0 232.2 L 600.5 229.2 L 599.2 225.8 L 599.0 224.0 L 594.8 215.5 L 592.2 211.5 L 590.2 209.2 L 589.2 207.0 L 582.0 199.8 L 581.5 198.8 L 572.5 191.0 L 570.2 189.8 L 569.0 188.5 L 564.0 185.8 L 562.2 184.2 L 558.8 182.5 L 557.5 182.2 L 555.5 180.8 L 552.8 179.8 L 551.5 178.8 L 549.8 178.2 L 544.5 175.5 L 543.2 175.5 L 538.8 173.5 L 536.5 173.0 L 535.0 172.2 L 534.0 172.2 L 529.5 170.5 L 528.5 170.5 L 527.0 169.5 L 525.0 169.5 L 521.5 168.0 L 519.0 168.0 L 515.8 166.8 L 514.0 166.8 L 510.2 165.8 L 505.8 165.2 L 503.0 164.2 L 498.8 164.2 L 498.5 164.0 L 493.2 163.8 L 490.2 163.0 L 483.2 162.8 L 483.0 162.5 L 480.2 162.5 L 480.0 162.8 L 473.0 162.5 L 472.8 162.8 L 469.0 162.8 L 468.5 163.2 L 468.5 163.8 L 471.8 167.5 L 482.0 177.8 L 482.5 178.8 L 488.0 184.8 L 488.2 185.5 L 489.5 186.8 L 492.8 192.8 L 493.0 194.2 L 494.8 198.2 L 495.8 204.5 L 496.0 211.8 L 495.0 219.0 L 493.0 224.5 L 492.8 226.2 L 490.5 230.2 L 490.2 231.5 L 486.8 236.0 L 486.5 236.8 L 481.2 242.0 L 480.5 242.2 L 477.8 244.8 L 474.5 246.5 L 473.2 247.8 L 470.8 248.5 L 465.8 251.2 L 459.2 253.8 L 446.8 260.0 L 443.8 261.0 L 441.8 262.2 L 435.8 264.2 L 433.2 265.8 L 432.2 265.8 L 423.5 269.5 L 422.0 269.8 L 409.8 274.5 L 409.0 274.5 L 401.2 277.5 L 400.5 277.5 L 399.5 278.2 L 396.5 278.8 L 393.8 280.0 L 390.8 280.5 L 389.5 281.2 L 387.0 281.8 L 385.0 282.8 L 382.2 283.2 L 377.5 285.0 L 376.8 285.0 L 375.5 285.8 L 371.8 286.5 L 367.5 288.0 L 366.0 288.0 L 362.2 289.5 L 356.8 290.5 L 353.8 291.8 L 352.5 291.8 L 351.8 292.2 L 348.8 292.8 L 347.0 293.5 L 341.0 294.5 L 337.5 295.8 L 335.2 295.8 L 332.0 296.8 L 328.5 297.2 L 327.0 298.0 L 326.0 298.0 L 322.8 299.0 L 320.8 299.0 L 319.2 299.8 L 317.8 299.8 L 316.0 300.5 L 310.5 301.2 L 306.5 302.2 L 304.5 302.2 L 302.8 303.0 L 298.8 303.5 L 293.0 305.0 L 290.5 305.0 L 287.2 306.0 L 283.5 306.2 L 279.8 307.2 L 272.5 308.0 L 271.8 308.5 L 265.2 309.2 L 263.2 310.0 L 256.2 310.5 L 255.2 311.0 L 248.2 311.5 L 247.2 312.0 L 240.0 312.5 L 236.5 313.5 L 229.0 314.0 L 221.2 315.0 L 216.2 315.2 L 215.5 315.8 L 208.5 316.2 L 207.2 316.8 L 203.2 316.8 L 193.2 317.8 L 184.2 318.0 L 183.5 318.5 L 181.0 318.5 L 180.8 318.8 L 168.0 319.2 L 166.0 319.8 L 155.2 320.2 L 144.8 321.5 L 143.2 321.2 L 142.2 321.8 L 143.2 322.2 L 148.8 322.5 L 149.0 322.8 L 178.2 323.8 L 178.5 324.0 L 183.2 324.0 L 184.5 324.5 L 199.2 324.8 L 199.5 325.0 L 205.2 325.0 L 205.5 325.2 L 207.2 325.0 L 208.8 325.5 L 215.2 325.5 L 216.8 326.0 L 218.0 325.8 L 218.2 326.0 L 240.2 326.5 L 245.0 327.2 L 311.5 327.8 L 311.8 327.5 L 326.0 327.5 L 326.2 327.2 L 338.2 327.0 L 338.5 326.8 L 343.2 326.8 L 346.5 326.2 L 359.2 326.0 L 360.5 325.5 L 367.2 325.5 L 368.2 325.0 L 375.5 325.0 L 376.8 324.5 L 382.8 324.2 L 384.0 323.8 L 389.5 323.5 L 399.8 322.2 L 403.5 322.2 L 407.5 321.8 L 408.2 321.2 L 417.5 320.5 L 422.0 319.5 L 427.2 319.2 L 429.0 318.8 L 434.2 318.2 L 438.5 317.2 L 442.0 317.0 L 446.0 316.0 L 452.2 315.2 L 454.8 314.5 L 458.8 314.2 L 462.2 313.2 L 465.2 313.0 L 469.2 311.8 L 471.0 311.8 L 474.8 310.8 L 481.8 309.8 L 485.5 308.5 L 489.5 308.0 L 491.5 307.2 L 495.0 306.8 L 496.5 306.0 L 497.8 306.0 L 503.2 304.5 L 510.8 303.5 L 521.8 304.0 L 525.8 305.2 L 527.2 305.2 L 530.8 307.0 L 532.8 307.5 L 536.5 309.8 L 538.0 310.2 L 539.0 311.2 L 541.5 312.2 L 550.5 320.8 L 554.0 325.5 L 554.5 327.0 L 555.5 328.0 L 558.2 333.2 L 558.5 335.2 L 560.0 338.0 L 561.5 343.8 L 561.5 346.0 L 562.5 352.2 L 562.2 366.2 L 564.2 375.5 L 565.0 376.8 L 565.0 377.5 L 566.0 379.2 L 566.2 380.5 L 567.5 382.5 L 568.2 385.0 L 569.5 386.8 L 569.8 388.0 L 573.5 394.8 L 574.2 396.8 L 575.5 398.2 L 577.0 401.2 L 581.2 405.2 L 583.2 406.0 L 584.5 407.0 L 587.5 407.8 L 591.2 407.8 L 594.0 407.2 L 598.8 405.2 L 609.5 399.8 L 611.2 399.2 L 614.2 397.5 L 617.5 396.2 L 622.5 393.5 L 623.2 393.5 L 627.0 391.2 L 631.5 389.2 L 632.2 388.5 Z M 464.0 234.5 L 461.5 232.0 L 458.8 230.2 L 455.2 227.0 L 453.8 226.2 L 452.2 224.5 L 449.0 222.2 L 447.5 220.8 L 446.8 220.5 L 445.0 218.8 L 443.2 217.8 L 442.5 216.5 L 441.0 215.8 L 439.2 214.0 L 438.5 213.8 L 436.8 212.0 L 432.5 209.0 L 425.0 202.5 L 421.2 200.0 L 417.5 196.5 L 414.0 194.0 L 407.0 188.0 L 406.2 187.8 L 402.5 184.2 L 401.8 184.0 L 400.2 182.5 L 396.8 180.0 L 393.0 176.5 L 390.2 174.8 L 388.0 172.5 L 384.8 170.2 L 383.0 168.5 L 382.2 168.2 L 376.0 162.8 L 374.2 161.8 L 363.2 152.5 L 362.5 152.2 L 361.0 150.8 L 360.2 150.5 L 358.8 149.0 L 358.0 148.8 L 355.2 146.5 L 353.0 144.0 L 350.0 142.0 L 343.5 136.5 L 342.0 135.8 L 339.0 132.8 L 337.0 131.5 L 335.5 130.0 L 334.8 129.8 L 333.0 128.0 L 330.2 126.2 L 319.0 116.5 L 318.5 116.5 L 317.0 115.0 L 315.0 113.8 L 312.0 110.8 L 310.8 110.2 L 303.5 104.0 L 302.8 103.8 L 300.8 101.8 L 296.0 98.2 L 293.8 96.0 L 292.8 95.5 L 290.0 93.0 L 288.8 92.5 L 287.0 90.5 L 283.8 88.2 L 281.8 86.2 L 280.5 85.8 L 279.0 84.5 L 277.2 84.5 L 276.5 85.0 L 275.5 86.2 L 272.5 88.2 L 264.0 95.5 L 262.2 96.5 L 260.8 98.2 L 256.8 101.0 L 249.2 107.5 L 248.8 107.5 L 243.5 112.0 L 240.5 114.0 L 239.0 115.8 L 237.0 117.0 L 231.2 122.0 L 224.5 127.0 L 209.2 139.8 L 208.2 140.2 L 204.5 143.8 L 203.0 144.5 L 201.5 146.0 L 200.2 146.5 L 199.5 147.5 L 198.5 148.0 L 192.5 153.2 L 190.0 154.8 L 184.8 159.5 L 183.2 160.2 L 181.2 162.5 L 179.0 164.0 L 177.5 165.5 L 176.2 166.0 L 174.8 167.5 L 172.8 168.5 L 168.8 172.5 L 164.5 175.8 L 163.8 176.0 L 161.5 178.5 L 160.8 178.8 L 154.8 183.5 L 154.2 183.5 L 153.2 182.2 L 153.2 115.0 L 151.8 114.0 L 91.0 114.0 L 90.0 114.8 L 89.8 115.5 L 89.8 224.2 L 90.0 225.5 L 89.8 225.8 L 89.8 231.5 L 89.2 234.2 L 87.5 237.8 L 85.2 240.0 L 84.0 240.5 L 83.0 241.8 L 80.8 243.2 L 79.2 244.8 L 78.5 245.0 L 73.8 249.2 L 72.5 249.8 L 70.5 251.2 L 65.2 256.0 L 64.5 256.2 L 61.2 259.2 L 59.5 260.2 L 57.5 262.2 L 54.2 264.2 L 52.8 266.0 L 52.0 266.2 L 49.2 268.8 L 48.5 269.0 L 46.0 271.5 L 44.5 272.2 L 43.2 273.8 L 42.5 274.0 L 33.2 281.8 L 32.2 282.0 L 31.2 283.2 L 24.5 288.5 L 21.0 291.8 L 16.2 295.5 L 14.8 296.2 L 13.2 298.0 L 5.5 304.0 L 4.0 305.5 L 4.0 318.5 L 64.5 318.8 L 64.8 319.0 L 79.8 319.0 L 80.0 318.8 L 86.2 319.0 L 88.2 318.8 L 90.8 317.2 L 98.2 310.5 L 103.5 306.8 L 105.0 305.0 L 107.0 303.8 L 110.0 301.0 L 111.8 300.0 L 112.2 299.2 L 115.5 297.0 L 118.8 294.0 L 119.2 294.0 L 122.8 290.5 L 125.0 289.2 L 128.2 286.0 L 129.8 285.2 L 134.2 281.2 L 135.0 281.0 L 138.2 278.0 L 143.2 274.2 L 145.0 272.2 L 146.2 271.8 L 154.5 264.8 L 156.5 263.5 L 158.2 261.8 L 159.2 261.2 L 160.5 259.8 L 161.2 259.5 L 168.5 253.2 L 169.2 253.0 L 178.5 245.0 L 184.0 241.0 L 190.2 235.5 L 191.2 235.2 L 192.5 233.8 L 195.0 232.0 L 196.8 230.2 L 203.0 225.5 L 206.5 222.2 L 207.2 222.0 L 214.5 215.8 L 215.2 215.5 L 219.2 211.8 L 227.5 205.5 L 238.8 196.0 L 240.8 194.8 L 248.5 188.0 L 250.2 187.0 L 268.8 171.5 L 271.5 169.8 L 273.2 168.0 L 276.8 166.2 L 278.8 166.2 L 280.8 167.2 L 282.2 167.5 L 284.0 169.2 L 285.5 170.0 L 288.5 173.0 L 289.8 173.5 L 291.8 175.5 L 294.8 177.5 L 296.2 179.2 L 297.5 179.8 L 302.2 184.0 L 313.5 192.8 L 315.8 195.0 L 319.0 197.2 L 320.5 198.8 L 322.0 199.5 L 326.8 203.5 L 328.2 205.2 L 329.5 205.8 L 330.8 207.2 L 337.2 212.0 L 339.0 213.8 L 349.5 222.0 L 350.5 223.2 L 352.2 224.2 L 358.0 229.2 L 359.2 229.8 L 362.0 232.0 L 363.0 233.2 L 366.8 236.2 L 367.5 236.5 L 368.2 237.5 L 371.5 239.8 L 374.2 242.2 L 375.0 242.5 L 383.0 249.2 L 383.8 249.5 L 389.2 254.0 L 390.8 255.8 L 392.5 257.0 L 393.5 257.2 L 395.8 259.0 L 399.8 260.0 L 401.0 260.0 L 405.2 258.8 L 411.0 256.2 L 413.8 255.5 L 416.0 254.2 L 419.8 253.2 L 421.5 252.2 L 423.0 252.0 L 429.8 249.0 L 433.2 248.0 L 438.0 245.8 L 441.0 245.0 L 443.5 243.8 L 447.0 242.8 L 448.8 241.8 L 451.8 241.0 L 454.0 239.8 L 455.8 239.5 L 458.0 238.0 L 458.8 238.0 L 460.8 236.8 L 463.2 236.0 L 464.0 235.2 Z";

/**
 * Gera o SVG vetorial do emblema oficial da Topa Tudo
 */
export function renderLogoIconSvg({
  size = 48,
  theme = 'dark',
  className = '',
}: {
  size?: number;
  theme?: 'dark' | 'light';
  className?: string;
}) {
  const darkColor = theme === 'dark' ? '#ffffff' : '#4E5756';
  const yellowColor = '#FDCD0A';

  // Proporção real do emblema oficial: 631.8 x 323.2 (~1.95:1)
  const height = size;
  const width = Math.round(size * 1.7);

  return (
    <svg
      width={width}
      height={height}
      viewBox="4.0 84.5 631.8 323.2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logotipo Oficial Topa Tudo"
    >
      <path
        d={TOPA_TUDO_EMBLEM_YELLOW_PATH}
        fill={yellowColor}
        fillRule="evenodd"
      />
      <path
        d={TOPA_TUDO_EMBLEM_DARK_PATH}
        fill={darkColor}
        fillRule="evenodd"
      />
    </svg>
  );
}

/**
 * Retorna string SVG pura para injeção HTML direta (impressão A4, PDF ou recibo)
 */
export function getLogoSvgRaw(theme: 'dark' | 'light' = 'dark'): string {
  const darkColor = theme === 'dark' ? '#ffffff' : '#4E5756';
  const yellowColor = '#FDCD0A';
  const textColor = theme === 'dark' ? '#ffffff' : '#1e293b';
  const subColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const badgeColor = '#FDCD0A';

  return `<svg viewBox="0 0 340 76" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;height:auto;max-height:100%;">
    <!-- Emblema Oficial -->
    <g transform="translate(2, 6) scale(0.18)">
      <path d="${TOPA_TUDO_EMBLEM_YELLOW_PATH}" fill="${yellowColor}" fill-rule="evenodd" />
      <path d="${TOPA_TUDO_EMBLEM_DARK_PATH}" fill="${darkColor}" fill-rule="evenodd" />
    </g>

    <!-- Tipografia Oficial -->
    <g transform="translate(124, 18)">
      <text x="0" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="27" font-weight="900" letter-spacing="2" fill="${textColor}">TOPA TUDO</text>
      <text x="0" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="9" font-weight="700" letter-spacing="1.8" fill="${subColor}">MANUTENÇÃO &amp; SERVIÇOS</text>
      <circle cx="152" cy="42" r="2.2" fill="${badgeColor}" />
      <text x="160" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="8" font-weight="800" letter-spacing="1.2" fill="#d97706">OFICIAL</text>
    </g>
  </svg>`;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme = 'dark',
  className = '',
  subtitle = 'Manutenção & Serviços',
}) => {
  const sizePixelMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 52,
    xl: 68,
  };

  const iconPx = sizePixelMap[size] || 40;
  const isLight = theme === 'light';

  if (variant === 'image') {
    return (
      <img
        src="/logo.png"
        alt="Topa Tudo"
        className={`object-contain ${className}`}
        style={{ height: iconPx * 1.5, width: 'auto' }}
      />
    );
  }

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderLogoIconSvg({ size: iconPx, theme })}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="relative mb-2 shrink-0 drop-shadow-sm">
          {renderLogoIconSvg({ size: Math.round(iconPx * 1.3), theme })}
        </div>
        <div className="space-y-0.5">
          <h1
            className={`font-black tracking-wider leading-none ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
            style={{ fontSize: Math.round(iconPx * 0.58) }}
          >
            TOPA TUDO
          </h1>
          <p
            className={`font-extrabold uppercase tracking-widest ${
              isLight ? 'text-amber-700' : 'text-amberAlert-400'
            }`}
            style={{ fontSize: Math.max(10, Math.round(iconPx * 0.22)) }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="shrink-0 relative drop-shadow-sm">
        {renderLogoIconSvg({ size: iconPx, theme })}
      </div>
      <div className="flex flex-col leading-tight select-none">
        <span
          className={`font-black tracking-wider uppercase ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
          style={{ fontSize: Math.max(16, Math.round(iconPx * 0.48)) }}
        >
          TOPA TUDO
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`font-bold tracking-widest uppercase ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}
            style={{ fontSize: Math.max(9, Math.round(iconPx * 0.21)) }}
          >
            {subtitle}
          </span>
          <span
            className="w-1 h-1 rounded-full bg-amberAlert-500 shrink-0"
          />
          <span
            className={`font-extrabold text-[9px] tracking-wider uppercase ${
              isLight ? 'text-amber-700' : 'text-amberAlert-400'
            }`}
          >
            Oficial
          </span>
        </div>
      </div>
    </div>
  );
};
