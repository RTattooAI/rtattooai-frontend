import { TestBed } from '@angular/core/testing';
import {
  LucideCheck,
  LucideChevronDown,
  LucideInfo,
  LucideX,
  provideLucideIcons
} from '@lucide/angular';
import { beforeEach, describe, expect, it } from 'vitest';
import { Combobox } from './combobox';
import { TagInput } from '../tag-input/tag-input';

/**
 * Los iconos se registran globalmente en app.config; en una prueba aislada hay que
 * darlos, o el componente falla al renderizar por un icono que no puede resolver.
 */
const PROVEEDORES = [provideLucideIcons(LucideX, LucideChevronDown, LucideCheck, LucideInfo)];

/**
 * El desplegable de banda y categoría existe para que lo normal sea elegir de la
 * lista y lo excepcional —una banda nueva— siga siendo posible. Lo que se prueba
 * aquí es justamente esa frontera: cuándo se considera que el valor es nuevo y qué
 * llega a emitirse, porque de ello depende que no se creen bandas duplicadas por un
 * error de tecleo.
 */
describe('Combobox', () => {
  function crear(options: string[], value = '') {
    const fixture = TestBed.createComponent(Combobox);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  }

  function escribir(fixture: ReturnType<typeof crear>, texto: string) {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: PROVEEDORES });
  });

  it('filtra las opciones por lo que se escribe, sin distinguir mayúsculas', () => {
    const fixture = crear(['Los Pulpos', 'Barrio 18', 'Tren de Aragua']);
    fixture.componentInstance.open();
    escribir(fixture, 'pulp');

    expect(fixture.componentInstance.filtered()).toEqual(['Los Pulpos']);
  });

  it('no marca como nuevo un valor que ya existe aunque cambie la caja', () => {
    const fixture = crear(['Los Pulpos']);
    fixture.componentInstance.open();
    escribir(fixture, 'los pulpos');

    // Sin esto, escribir la misma banda en minúsculas la duplicaría.
    expect(fixture.componentInstance.isNew()).toBe(false);
  });

  it('encuentra una opción acentuada aunque se escriba sin tildes', () => {
    const fixture = crear(['Símbolo', 'Corona']);
    fixture.componentInstance.open();
    escribir(fixture, 'simbolo');

    expect(fixture.componentInstance.filtered()).toEqual(['Símbolo']);
  });

  it('no marca como nuevo un valor que solo difiere en la tilde', () => {
    const fixture = crear(['Símbolo']);
    fixture.componentInstance.open();
    escribir(fixture, 'simbolo');

    // Avisar de «categoría nueva» aquí crearía el duplicado «Simbolo»/«Símbolo»
    // que el vocabulario existe para evitar.
    expect(fixture.componentInstance.isNew()).toBe(false);
  });

  it('marca como nuevo lo que no está en la lista', () => {
    const fixture = crear(['Los Pulpos']);
    fixture.componentInstance.open();
    escribir(fixture, 'Banda Nueva');

    expect(fixture.componentInstance.isNew()).toBe(true);
  });

  it('un campo vacío no cuenta como valor nuevo', () => {
    const fixture = crear(['Los Pulpos']);
    fixture.componentInstance.open();
    escribir(fixture, '   ');

    expect(fixture.componentInstance.isNew()).toBe(false);
  });

  it('elegir una opción la emite y cierra el desplegable', () => {
    const fixture = crear(['Los Pulpos', 'Barrio 18']);
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.open();
    fixture.componentInstance.select('Barrio 18');

    expect(emitido).toBe('Barrio 18');
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('las flechas recorren la lista filtrada y Intro elige la marcada', () => {
    const fixture = crear(['Los Pulpos', 'Barrio 18', 'Tren de Aragua']);
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.open();
    fixture.componentInstance.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.componentInstance.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.componentInstance.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitido).toBe('Barrio 18');
  });

  it('vaciar emite cadena vacía', () => {
    const fixture = crear(['Los Pulpos'], 'Los Pulpos');
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.clear();

    expect(emitido).toBe('');
  });

  it('con allowCustom en falso, un valor inventado se descarta al salir del campo', () => {
    const fixture = TestBed.createComponent(Combobox);
    fixture.componentRef.setInput('options', ['Los Pulpos']);
    fixture.componentRef.setInput('value', 'Los Pulpos');
    fixture.componentRef.setInput('allowCustom', false);
    fixture.detectChanges();

    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.open();
    escribir(fixture, 'Inventada');
    fixture.componentInstance.onBlur(new FocusEvent('blur'));

    expect(emitido).toBe('Los Pulpos');
  });
});

describe('TagInput', () => {
  function crear(value = '', suggestions: string[] = []) {
    const fixture = TestBed.createComponent(TagInput);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('suggestions', suggestions);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: PROVEEDORES });
  });

  it('normaliza igual que el servidor: minúsculas y sin repetidos', () => {
    const fixture = crear('corona');
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.add('  PUNTAS  ');
    expect(emitido).toBe('corona,puntas');

    fixture.componentRef.setInput('value', 'corona,puntas');
    fixture.detectChanges();
    emitido = null;
    fixture.componentInstance.add('Corona');

    // Ya estaba: no se emite nada y la etiqueta no se duplica.
    expect(emitido).toBeNull();
  });

  it('no acepta más etiquetas que el tope del servidor', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `t${i}`).join(',');
    const fixture = crear(muchas);
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    expect(fixture.componentInstance.isFull()).toBe(true);
    fixture.componentInstance.add('sobra');
    expect(emitido).toBeNull();
  });

  it('quitar una etiqueta deja el resto intacto', () => {
    const fixture = crear('corona,puntas,leon');
    let emitido: string | null = null;
    fixture.componentInstance.valueChange.subscribe((v) => (emitido = v));

    fixture.componentInstance.remove('puntas');

    expect(emitido).toBe('corona,leon');
  });

  it('las sugerencias no repiten lo ya puesto', () => {
    const fixture = crear('corona', ['corona', 'puntas', 'leon']);

    expect(fixture.componentInstance.available()).toEqual(['puntas', 'leon']);
  });
});
