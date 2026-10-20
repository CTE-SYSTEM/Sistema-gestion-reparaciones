import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { focusAdjacentFormField } from './formKeyboardNavigation';

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const Autocomplete = ({
  label,
  name,
  value,
  options = [],
  onChange,
  getOptionValue = (option) => option.value,
  getOptionLabel = (option) => option.label,
  getOptionDescription,
  placeholder = 'Escriba para buscar...',
  helpText,
  emptyMessage = 'Sin coincidencias',
  required = false,
  disabled = false,
  allowCustom = false,
  matchMode = 'contains',
  onQueryChange,
  className = '',
  maxLength,
}) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const [draft, setDraft] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = useMemo(
    () => options.find((option) => String(getOptionValue(option)) === String(value)),
    [getOptionValue, options, value]
  );

  const inputValue = draft && Object.is(draft.sourceValue, value) ? draft.text
    : allowCustom ? String(value ?? '') : selectedOption ? getOptionLabel(selectedOption) : '';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = normalizeText(searchQuery.trim());
    const visibleOptions = term
      ? options.filter((option) => {
          const labelText = getOptionLabel(option);
          const descriptionText = getOptionDescription?.(option) || '';
          if (matchMode === 'prefix') {
            return /^\d+$/.test(term)
              ? normalizeText(descriptionText).includes(term)
              : normalizeText(labelText).trimStart().startsWith(term);
          }
          return normalizeText(`${labelText} ${descriptionText}`).includes(term);
        })
      : options;

    return visibleOptions.slice(0, 12);
  }, [getOptionDescription, getOptionLabel, searchQuery, matchMode, options]);

  const emitChange = (nextValue) => {
    onChange?.({ target: { name, value: nextValue } });
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    const nextSource = allowCustom ? nextValue : !nextValue || selectedOption && nextValue !== getOptionLabel(selectedOption) ? '' : value;
    setDraft({ text: nextValue, sourceValue: nextSource });
    setSearchQuery(nextValue);
    onQueryChange?.(nextValue);
    setIsOpen(true);
    setActiveIndex(-1);

    if (allowCustom) {
      emitChange(nextValue);
      return;
    }

    if (!nextValue) {
      emitChange('');
      return;
    }

    if (selectedOption && nextValue !== getOptionLabel(selectedOption)) {
      emitChange('');
    }
  };

  const selectOption = (option, advance = false) => {
    const nextValue = getOptionValue(option);
    setDraft(null);
    emitChange(nextValue);
    setIsOpen(false);
    setSearchQuery('');
    setActiveIndex(-1);
    if (advance && inputRef.current?.closest('form,[data-keyboard-form]')) focusAdjacentFormField(inputRef.current);
    else inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Tab') { setIsOpen(false); setSearchQuery(''); return; }
    if (event.altKey && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      setIsOpen(false); setSearchQuery(''); setActiveIndex(-1);
      focusAdjacentFormField(event.currentTarget, ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1, true);
      return;
    }
    if (event.key === 'Escape') {
      if (isOpen) { event.preventDefault(); event.stopPropagation(); }
      setIsOpen(false);
      setSearchQuery('');
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      if (filteredOptions.length) {
        setActiveIndex((index) => event.key === 'ArrowDown'
          ? (index + 1) % filteredOptions.length
          : (index < 0 ? filteredOptions.length - 1 : (index - 1 + filteredOptions.length) % filteredOptions.length));
      }
      return;
    }
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    if (event.shiftKey) { setIsOpen(false); setSearchQuery(''); setActiveIndex(-1); focusAdjacentFormField(event.currentTarget, -1); return; }
    const exact = filteredOptions.find((option) => normalizeText(getOptionLabel(option)) === normalizeText(inputValue.trim()));
    const chosen = activeIndex >= 0 ? filteredOptions[activeIndex] : exact || (filteredOptions.length === 1 ? filteredOptions[0] : null);
    if (chosen) selectOption(chosen);
    if (chosen || (allowCustom && inputValue.trim()) || (selectedOption && normalizeText(inputValue) === normalizeText(getOptionLabel(selectedOption)))) {
      setIsOpen(false); setSearchQuery(''); setActiveIndex(-1);
      focusAdjacentFormField(event.currentTarget);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsOpen(false); setSearchQuery(''); setActiveIndex(-1);
      }
    }}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-label={label || name || placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen && !disabled}
          aria-controls={isOpen && !disabled ? listId : undefined}
          aria-activedescendant={isOpen && activeIndex >= 0 && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          type="text"
          name={`${name}_search`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={(event) => {
            if (disabled) return;
            setSearchQuery('');
            setActiveIndex(-1);
            setIsOpen(true);
            if (value) event.currentTarget.select();
          }}
          onKeyDown={handleKeyDown}
          data-autocomplete-input="true"
          placeholder={placeholder}
          aria-describedby={helpText ? `${name}-help` : undefined}
          required={required && !value}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete="off"
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 outline-none transition-all"
        />
        <button
          type="button"
          data-keyboard-skip
          aria-label={`Mostrar opciones de ${label || name || 'búsqueda'}`}
          onClick={() => {
            if (disabled) return;
            setSearchQuery('');
            setActiveIndex(-1);
            setIsOpen((open) => !open);
          }}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          title="Mostrar opciones"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {helpText && <p id={`${name}-help`} className="mt-1 text-xs text-slate-500 text-left">{helpText}</p>}

      {isOpen && !disabled && (
        <div id={listId} role="listbox" aria-label={label || name || 'Opciones'} className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const optionValue = getOptionValue(option);
              const description = getOptionDescription?.(option);

              return (
                <button
                  key={optionValue}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  data-keyboard-skip
                  type="button"
                  onClick={() => selectOption(option, true)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none ${activeIndex === index ? 'bg-indigo-50' : ''}`}
                >
                  <span className="text-sm font-medium text-gray-800">{getOptionLabel(option)}</span>
                  {description && <span className="text-xs text-gray-500">{description}</span>}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-gray-400">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
