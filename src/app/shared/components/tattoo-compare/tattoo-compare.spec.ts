import { TestBed } from '@angular/core/testing';
import { TattooCompare } from './tattoo-compare';

describe('TattooCompare', () => {
  function crear(bbox: { x: number; y: number; width: number; height: number }) {
    const fixture = TestBed.createComponent(TattooCompare);
    fixture.componentRef.setInput('imageUrl', 'https://img.test/foto.jpg');
    fixture.componentRef.setInput('imageWidth', 1000);
    fixture.componentRef.setInput('imageHeight', 800);
    fixture.componentRef.setInput('bbox', bbox);
    fixture.componentRef.setInput('match', { catalogId: 'tat_00001', band: 'A', similarity: 0.82, referenceImageUrl: null });
    return fixture.componentInstance;
  }

  it('amplía la caja con un margen del 12 %', () => {
    const c = crear({ x: 100, y: 100, width: 200, height: 100 }).crop();
    expect(c.x).toBeCloseTo(76);
    expect(c.y).toBeCloseTo(88);
    expect(c.width).toBeCloseTo(248);
    expect(c.height).toBeCloseTo(124);
  });

  it('no se sale de los bordes de la imagen', () => {
    const c = crear({ x: 0, y: 0, width: 1000, height: 800 }).crop();
    expect(c).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('el zoom queda entre 1× y 4×', () => {
    const cmp = crear({ x: 10, y: 10, width: 50, height: 50 });
    cmp.zoomOut();
    expect(cmp.zoom()).toBe(1);
    for (let i = 0; i < 10; i++) cmp.zoomIn();
    expect(cmp.zoom()).toBe(4);
  });

  it('muestra la similitud en porcentaje', () => {
    expect(crear({ x: 0, y: 0, width: 10, height: 10 }).similarityPct()).toBe(82);
  });
});
