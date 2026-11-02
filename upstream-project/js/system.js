// Shared image helper for photo seeds and Control4 snapshots.
(function () {
  'use strict';
  App.img = function (seed, w, h) {
    return 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;
  };
})();
