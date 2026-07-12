(function () {
    'use strict';

    var folhas = document.querySelectorAll('link[data-async-css][media="print"]');
    for (var i = 0; i < folhas.length; i += 1) {
        folhas[i].media = 'all';
    }
})();
